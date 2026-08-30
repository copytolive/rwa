#!/usr/bin/env python3
"""Build canonical XAU/USD fixed-1s OHLC history from Dukascopy BI5 ticks.

The repository stays light: monthly gzip CSV packs are intended for GitHub Release
assets, not Git blobs. Each pack contains only seconds that had at least one source
tick. Raw BI5 bytes are discarded after aggregation, but a deterministic provenance
digest over every downloaded source hour is retained in the summary.

CSV schema (gzip):
  unix_second,open_tick,high_tick,low_tick,close_tick\n
Prices are integer multiples of tickSize (normally 0.001 for XAU/USD). This avoids
floating-point drift in browser rendering and backtests.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import gzip
import hashlib
import json
import lzma
import os
import pathlib
import struct
import sys
import time
import urllib.error
import urllib.request

BASE = "https://datafeed.dukascopy.com/datafeed/XAUUSD"
UA = "copytolive-renko-gold-history/1.0"
REC = struct.Struct(">IIIff")
UTC = dt.timezone.utc
ORIGIN = dt.datetime(2003, 5, 5, tzinfo=UTC)
DEFAULT_END = dt.datetime(2026, 8, 30, 23, 59, 59, tzinfo=UTC)


def month_days(year: int, month: int):
    cur = dt.date(year, month, 1)
    nxt = dt.date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    while cur < nxt:
        yield cur
        cur += dt.timedelta(days=1)


def hour_url(day: dt.date, hour: int) -> str:
    # Dukascopy month component is zero-based.
    return f"{BASE}/{day.year:04d}/{day.month-1:02d}/{day.day:02d}/{hour:02d}h_ticks.bi5"


def fetch_bytes(url: str, retries: int = 5) -> bytes | None:
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=35) as r:
                data = r.read()
                return data if data else None
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            last = e
        except Exception as e:  # network reset/timeouts
            last = e
        time.sleep(min(12.0, 0.8 * (2 ** attempt)))
    raise RuntimeError(f"download failed after {retries} attempts: {url}: {last}")


def decode_ticks(blob: bytes, scale: int):
    raw = lzma.decompress(blob)
    if len(raw) % REC.size:
        raise ValueError(f"invalid BI5 payload length {len(raw)}")
    out = []
    prev_ms = -1
    for off in range(0, len(raw), REC.size):
        ms, ask_i, bid_i, ask_vol, bid_vol = REC.unpack_from(raw, off)
        if ms >= 3_600_000:
            raise ValueError(f"invalid millisecond offset {ms}")
        if ms < prev_ms:
            raise ValueError("non-monotonic tick time within BI5 hour")
        prev_ms = ms
        if ask_i < bid_i:
            raise ValueError("ask < bid in source tick")
        out.append((ms, ask_i, bid_i))
    return out


def px_int(ask_i: int, bid_i: int, side: str, source_scale: int, tick_scale: int = 1000) -> int:
    # Convert source integer price to canonical 0.001 ticks without float drift.
    if side == "bid":
        num = bid_i
        den = source_scale
    elif side == "ask":
        num = ask_i
        den = source_scale
    elif side == "mid":
        num = ask_i + bid_i
        den = 2 * source_scale
    else:
        raise ValueError(side)
    return int(round(num * tick_scale / den))


def aggregate_hour(blob: bytes, day: dt.date, hour: int, side: str, source_scale: int):
    ticks = decode_ticks(blob, source_scale)
    base_sec = int(dt.datetime(day.year, day.month, day.day, hour, tzinfo=UTC).timestamp())
    bars = []
    cur_sec = None
    o = h = l = c = None
    for ms, ask_i, bid_i in ticks:
        sec = base_sec + ms // 1000
        p = px_int(ask_i, bid_i, side, source_scale)
        if cur_sec != sec:
            if cur_sec is not None:
                bars.append((cur_sec, o, h, l, c))
            cur_sec = sec
            o = h = l = c = p
        else:
            if p > h: h = p
            if p < l: l = p
            c = p
    if cur_sec is not None:
        bars.append((cur_sec, o, h, l, c))
    return bars


def ref_bar(row):
    if isinstance(row, dict):
        t = row.get("time", row.get("t", row.get("timestamp", row.get("openTime"))))
        o = row.get("open", row.get("o")); h = row.get("high", row.get("h"))
        l = row.get("low", row.get("l")); c = row.get("close", row.get("c"))
    else:
        if len(row) < 5: return None
        t, o, h, l, c = row[:5]
    if None in (t, o, h, l, c): return None
    t = int(float(t))
    if t > 10_000_000_000: t //= 1000
    return (t, float(o), float(h), float(l), float(c))


def calibrate(reference_pack: pathlib.Path, day: dt.date, output: pathlib.Path):
    with gzip.open(reference_pack, "rt", encoding="utf-8") as f:
        payload = json.load(f)
    rows = payload.get("bars", payload if isinstance(payload, list) else [])
    refs = {}
    for r in rows:
        q = ref_bar(r)
        if q:
            refs[q[0]] = q[1:]
    if not refs:
        raise RuntimeError("reference pack contains no parseable bars")

    candidates = []
    # Use several active hours from the known reference day.
    blobs = []
    for hour in range(24):
        b = fetch_bytes(hour_url(day, hour))
        if b:
            blobs.append((hour, b))
        if len(blobs) >= 4:
            break
    if not blobs:
        raise RuntimeError("no source BI5 hours available for calibration day")

    for source_scale in (1000, 100, 10000, 100000):
        for side in ("bid", "ask", "mid"):
            compared = exact = 0
            abs_err = 0.0
            try:
                for hour, blob in blobs:
                    for sec, o, h, l, c in aggregate_hour(blob, day, hour, side, source_scale):
                        rr = refs.get(sec)
                        if not rr: continue
                        vals = (o/1000.0, h/1000.0, l/1000.0, c/1000.0)
                        compared += 1
                        err = max(abs(vals[i] - rr[i]) for i in range(4))
                        abs_err += err
                        if err <= 0.00051: exact += 1
                        if compared >= 5000: break
                    if compared >= 5000: break
            except Exception:
                continue
            if compared:
                candidates.append({
                    "sourceScale": source_scale, "side": side, "compared": compared,
                    "exact": exact, "exactRatio": exact/compared, "meanMaxError": abs_err/compared,
                })
    if not candidates:
        raise RuntimeError("no calibration candidate could be evaluated")
    candidates.sort(key=lambda x: (-x["exactRatio"], x["meanMaxError"], -x["compared"]))
    best = candidates[0]
    if best["compared"] < 100 or best["exactRatio"] < 0.90:
        raise RuntimeError("source decoder failed reference parity: " + json.dumps(candidates[:6]))
    result = {
        "schema": "renko-gold-calibration-v1", "provider": "Dukascopy", "instrumentCode": "XAU-USD",
        "referenceDate": day.isoformat(), "referencePack": str(reference_pack),
        "tickSize": 0.001, "priceSide": best["side"], "sourceScale": best["sourceScale"],
        "exactRatio": best["exactRatio"], "compared": best["compared"],
        "candidates": candidates[:6],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print("RENKO_GOLD_CALIBRATION_PASS", json.dumps(result, separators=(",", ":")))


def build_month(year: int, month: int, outdir: pathlib.Path, side: str, source_scale: int,
                start: dt.datetime, end: dt.datetime, workers: int):
    mstart = dt.datetime(year, month, 1, tzinfo=UTC)
    mend = dt.datetime(year + (month == 12), 1 if month == 12 else month + 1, 1, tzinfo=UTC) - dt.timedelta(microseconds=1)
    if mend < start or mstart > end:
        return None

    outdir.mkdir(parents=True, exist_ok=True)
    rawdir = outdir / f".raw-{year:04d}-{month:02d}"
    rawdir.mkdir(exist_ok=True)
    specs = []
    for day in month_days(year, month):
        for hour in range(24):
            hour_dt = dt.datetime(day.year, day.month, day.day, hour, tzinfo=UTC)
            if hour_dt + dt.timedelta(hours=1) <= start or hour_dt > end:
                continue
            specs.append((day, hour, hour_url(day, hour)))

    def one(spec):
        day, hour, url = spec
        blob = fetch_bytes(url)
        if not blob:
            return (day, hour, url, None, None)
        sha = hashlib.sha256(blob).hexdigest()
        p = rawdir / f"{day.isoformat()}-{hour:02d}.bi5"
        p.write_bytes(blob)
        return (day, hour, url, p, sha)

    rows = []
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for item in ex.map(one, specs):
            rows.append(item)
    rows.sort(key=lambda x: (x[0], x[1]))

    asset = outdir / f"xauusd-s1-{year:04d}-{month:02d}.csv.gz"
    bar_count = 0; earliest = None; latest = None; source_hours = 0; missing_hours = 0
    prov = hashlib.sha256()
    with open(asset, "wb") as rawout:
        with gzip.GzipFile(filename="", mode="wb", fileobj=rawout, compresslevel=9, mtime=0) as gz:
            gz.write(b"unix_second,open_tick,high_tick,low_tick,close_tick\n")
            for day, hour, url, p, sha in rows:
                if p is None:
                    missing_hours += 1
                    continue
                source_hours += 1
                prov.update(url.encode()); prov.update(b"\0"); prov.update(sha.encode()); prov.update(b"\n")
                blob = p.read_bytes()
                bars = aggregate_hour(blob, day, hour, side, source_scale)
                for sec, o, h, l, c in bars:
                    if sec < int(start.timestamp()) or sec > int(end.timestamp()):
                        continue
                    gz.write(f"{sec},{o},{h},{l},{c}\n".encode())
                    bar_count += 1
                    if earliest is None: earliest = sec
                    latest = sec
                p.unlink(missing_ok=True)
    try: rawdir.rmdir()
    except OSError: pass

    if bar_count == 0:
        asset.unlink(missing_ok=True)
        return None
    sha256 = hashlib.sha256(asset.read_bytes()).hexdigest()
    info = {
        "schema": "renko-gold-month-v1", "provider": "Dukascopy", "instrumentCode": "XAU-USD",
        "symbol": "XAUUSD", "interval": "1s", "year": year, "month": month,
        "asset": asset.name, "format": "csv.gz", "priceEncoding": "integer-ticks",
        "tickSize": 0.001, "priceSide": side, "sourceScale": source_scale,
        "barCount": bar_count, "earliestSecond": earliest, "latestSecond": latest,
        "sourceHours": source_hours, "notFoundHours": missing_hours,
        "sourceDigestSha256": prov.hexdigest(), "assetSha256": sha256, "bytes": asset.stat().st_size,
    }
    print("RENKO_GOLD_MONTH_PASS", json.dumps(info, separators=(",", ":")))
    return info


def backfill_year(args):
    outdir = pathlib.Path(args.output_dir)
    start = dt.datetime.fromisoformat(args.start.replace("Z", "+00:00"))
    end = dt.datetime.fromisoformat(args.end.replace("Z", "+00:00"))
    if start.tzinfo is None: start = start.replace(tzinfo=UTC)
    if end.tzinfo is None: end = end.replace(tzinfo=UTC)
    months = []
    for month in range(1, 13):
        info = build_month(args.year, month, outdir, args.side, args.source_scale, start, end, args.workers)
        if info: months.append(info)
    summary = {
        "schema": "renko-gold-year-v1", "provider": "Dukascopy", "instrumentCode": "XAU-USD",
        "year": args.year, "start": start.isoformat(), "end": end.isoformat(),
        "priceSide": args.side, "sourceScale": args.source_scale, "tickSize": 0.001,
        "months": months, "barCount": sum(m["barCount"] for m in months),
        "bytes": sum(m["bytes"] for m in months),
    }
    sp = outdir / f"summary-{args.year}.json"
    sp.write_text(json.dumps(summary, indent=2) + "\n")
    if args.year >= 2003 and args.year <= 2026 and not months:
        raise RuntimeError(f"year {args.year} produced no history")
    print("RENKO_GOLD_YEAR_PASS", json.dumps(summary, separators=(",", ":")))


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("calibrate")
    c.add_argument("--reference-pack", required=True)
    c.add_argument("--date", default="2026-08-28")
    c.add_argument("--output", required=True)
    b = sub.add_parser("backfill-year")
    b.add_argument("--year", type=int, required=True)
    b.add_argument("--side", choices=["bid", "ask", "mid"], required=True)
    b.add_argument("--source-scale", type=int, required=True)
    b.add_argument("--start", default=ORIGIN.isoformat())
    b.add_argument("--end", default=DEFAULT_END.isoformat())
    b.add_argument("--workers", type=int, default=4)
    b.add_argument("--output-dir", required=True)
    a = p.parse_args()
    if a.cmd == "calibrate":
        calibrate(pathlib.Path(a.reference_pack), dt.date.fromisoformat(a.date), pathlib.Path(a.output))
    else:
        backfill_year(a)

if __name__ == "__main__":
    main()
