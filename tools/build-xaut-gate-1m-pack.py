#!/usr/bin/env python3
"""Build the same-origin XAUT/USDT 1m history pack used by the Renko ATR worker.

Gate publishes unauthenticated spot 1m K-line archives as one gzip CSV per UTC day:
  https://download.gatedata.org/spot/candlesticks_1m/YYYYMM/XAUT_USDT-YYYYMMDD.csv.gz

Archive CSV columns are:
  timestamp_s, volume, close, high, low, open

The generated pack stays compact (~1.05M latest *actual* Gate candles), is deterministic,
and can be served by GitHub Pages so the browser worker avoids cross-origin/rate-limit
fan-out for ATR 1,000,000. On later runs only newly published UTC days are fetched.
"""
from __future__ import annotations

import concurrent.futures
import csv
import datetime as dt
import gzip
import hashlib
import io
import json
import os
import pathlib
import time
import urllib.error
import urllib.request

ROOT = "https://download.gatedata.org/spot/candlesticks_1m"
PAIR = "XAUT_USDT"
KEEP_ROWS = 1_050_000
INITIAL_DAYS = 820
MAX_WORKERS = 16
OUT_DIR = pathlib.Path("renko/data")
PACK = OUT_DIR / "xaut-gate-1m-pack.csv.gz"
META = OUT_DIR / "xaut-gate-1m-pack.meta.json"
UA = "copytolive-renko-history-pack/1.0"


def archive_url(day: dt.date) -> str:
    ymd = day.strftime("%Y%m%d")
    ym = day.strftime("%Y%m")
    return f"{ROOT}/{ym}/{PAIR}-{ymd}.csv.gz"


def fetch_day(day: dt.date):
    url = archive_url(day)
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                raw = r.read()
            text = gzip.decompress(raw).decode("utf-8")
            rows = []
            for rec in csv.reader(io.StringIO(text)):
                if len(rec) < 6:
                    continue
                try:
                    ts = int(float(rec[0]))
                    vol = float(rec[1])
                    close = float(rec[2])
                    high = float(rec[3])
                    low = float(rec[4])
                    open_ = float(rec[5])
                except Exception:
                    continue
                if ts <= 0 or not all(map(lambda x: x == x and abs(x) != float("inf"), (open_, high, low, close, vol))):
                    continue
                rows.append((ts, vol, close, high, low, open_))
            return day, rows, url, len(raw), None
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return day, [], url, 0, "404"
            last = e
        except Exception as e:
            last = e
        time.sleep(0.35 * (attempt + 1))
    return day, [], url, 0, str(last or "fetch failed")


def read_existing():
    rows = []
    meta = {}
    if META.exists():
        try:
            meta = json.loads(META.read_text())
        except Exception:
            meta = {}
    if PACK.exists():
        try:
            with gzip.open(PACK, "rt", encoding="utf-8", newline="") as f:
                for rec in csv.reader(f):
                    if len(rec) < 6:
                        continue
                    rows.append((int(rec[0]), float(rec[1]), float(rec[2]), float(rec[3]), float(rec[4]), float(rec[5])))
        except Exception:
            rows = []
    return rows, meta


def day_range(start: dt.date, end: dt.date):
    cur = start
    while cur <= end:
        yield cur
        cur += dt.timedelta(days=1)


def fmt_num(v: float) -> str:
    return format(v, ".12g")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    existing, old_meta = read_existing()
    # Gate daily files observed in production are published a few hours after UTC day end.
    # Never request today; yesterday is the newest candidate.
    today = dt.datetime.now(dt.timezone.utc).date()
    end_day = today - dt.timedelta(days=1)
    if existing and old_meta.get("lastArchiveDate"):
        try:
            start_day = dt.date.fromisoformat(old_meta["lastArchiveDate"]) + dt.timedelta(days=1)
        except Exception:
            start_day = end_day - dt.timedelta(days=INITIAL_DAYS - 1)
        # Repair a small overlap so a previously missing/late archive can be picked up.
        start_day = min(start_day, end_day) - dt.timedelta(days=2)
    else:
        start_day = end_day - dt.timedelta(days=INITIAL_DAYS - 1)

    days = list(day_range(start_day, end_day))
    print(f"XAUT pack: existing={len(existing):,} fetch_days={len(days)} {start_day}..{end_day}")
    fetched = []
    failures = []
    compressed_bytes = 0
    if days:
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futs = [ex.submit(fetch_day, d) for d in days]
            for i, fut in enumerate(concurrent.futures.as_completed(futs), 1):
                day, rows, url, nbytes, err = fut.result()
                compressed_bytes += nbytes
                if rows:
                    fetched.extend(rows)
                    print(f"[{i:03d}/{len(days):03d}] {day} rows={len(rows):,} bytes={nbytes:,}")
                else:
                    failures.append({"date": day.isoformat(), "url": url, "error": err or "empty"})
                    print(f"[{i:03d}/{len(days):03d}] {day} unavailable={err or 'empty'}")

    merged = {r[0]: r for r in existing}
    for r in fetched:
        merged[r[0]] = r
    rows = [merged[k] for k in sorted(merged)]
    if len(rows) > KEEP_ROWS:
        rows = rows[-KEEP_ROWS:]
    if len(rows) < 1_000_999:
        raise SystemExit(f"insufficient XAUT Gate 1m candles: {len(rows):,} < 1,000,999")

    buf = io.StringIO(newline="")
    w = csv.writer(buf, lineterminator="\n")
    for ts, vol, close, high, low, open_ in rows:
        w.writerow((ts, fmt_num(vol), fmt_num(close), fmt_num(high), fmt_num(low), fmt_num(open_)))
    plain = buf.getvalue().encode("utf-8")
    tmp = PACK.with_suffix(PACK.suffix + ".tmp")
    with open(tmp, "wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as gz:
            gz.write(plain)
    os.replace(tmp, PACK)
    packed = PACK.read_bytes()

    first_ts, last_ts = rows[0][0], rows[-1][0]
    last_archive_date = dt.datetime.fromtimestamp(last_ts, tz=dt.timezone.utc).date().isoformat()
    meta = {
        "schema": "renko-xaut-gate-1m-pack-v1",
        "pair": PAIR,
        "venue": "Gate Spot",
        "interval": "1m",
        "source": "Gate historical quotation daily candlesticks_1m archives",
        "rows": len(rows),
        "firstOpenTime": first_ts * 1000,
        "lastOpenTime": last_ts * 1000,
        "lastCloseTime": last_ts * 1000 + 59_999,
        "firstUtc": dt.datetime.fromtimestamp(first_ts, tz=dt.timezone.utc).isoformat(),
        "lastUtc": dt.datetime.fromtimestamp(last_ts, tz=dt.timezone.utc).isoformat(),
        "lastArchiveDate": last_archive_date,
        "plainSha256": hashlib.sha256(plain).hexdigest(),
        "gzipSha256": hashlib.sha256(packed).hexdigest(),
        "gzipBytes": len(packed),
        "minimumRequiredRows": 1_000_999,
        "buildFetchedCompressedBytes": compressed_bytes,
        "buildUnavailableDays": failures[-20:],
    }
    META.write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
