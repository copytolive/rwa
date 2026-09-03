#!/usr/bin/env python3
"""Build canonical XAU/USD fixed-1s OHLC history from Dukascopy Jetta ticks.

The verified RENKO GOLD origin/recent packs use the public Jetta Dukascopy source.
This backfill therefore uses the same hourly endpoint family instead of changing
providers during deep history.

The repository stays light: monthly gzip CSV packs are published as large-data
objects outside normal Git blobs and are never bundled into first paint. Raw compact
tick responses are discarded after aggregation, while each month keeps a
deterministic SHA256 provenance digest over the exact source bytes that were read.

CSV schema (gzip):
  unix_second,open_tick,high_tick,low_tick,close_tick\n
Prices are integer multiples of 0.001 USD. Empty source seconds are not fabricated.
Transient transport errors are retried aggressively but are never reclassified as
empty/not-found source data.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import datetime as dt
import gzip
import hashlib
import json
import pathlib
import random
import threading
import time
import urllib.error
import urllib.request

BASE = "https://jetta.dukascopy.com/v1/ticks/XAU-USD"
UA = "copytolive-renko-gold-history/2.1"
UTC = dt.timezone.utc
ORIGIN = dt.datetime(2003, 5, 5, tzinfo=UTC)
DEFAULT_END = dt.datetime(2026, 8, 28, 23, 59, 59, tzinfo=UTC)
TICK_SCALE = 1000  # canonical integer price unit = 0.001 USD
RECOVERY_GATE = threading.Semaphore(2)
RECOVERY_ATTEMPTS = 8


def month_days(year: int, month: int):
    cur = dt.date(year, month, 1)
    nxt = dt.date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    while cur < nxt:
        yield cur
        cur += dt.timedelta(days=1)


def hour_url(day: dt.date, hour: int) -> str:
    return f"{BASE}/{day.year:04d}/{day.month:02d}/{day.day:02d}/{hour:02d}"


def _fetch_once(url: str, timeout: float) -> bytes | None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "application/json",
            "Connection": "close",
            "Cache-Control": "no-cache",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        return data if data else None


def fetch_bytes(url: str, retries: int = 5) -> bytes | None:
    """Fetch one exact Dukascopy hour without turning transport errors into gaps.

    The fast phase runs with normal parallelism. If every fast attempt fails for a
    transport/server reason, recovery is admitted through a tiny global semaphore
    so a transient Dukascopy/CDN slowdown cannot create a retry stampede. Only an
    explicit HTTP 404/410 is returned as source not-found. Any unresolved transport
    failure still aborts the build, preserving source truth.
    """
    last = None
    fast_attempts = max(1, int(retries))
    for attempt in range(fast_attempts):
        try:
            return _fetch_once(url, timeout=30 + min(10, attempt * 2))
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            last = e
            retry_after = e.headers.get("Retry-After") if getattr(e, "headers", None) else None
            if retry_after:
                try:
                    time.sleep(min(30.0, max(0.0, float(retry_after))))
                    continue
                except Exception:
                    pass
        except Exception as e:
            last = e
        if attempt + 1 < fast_attempts:
            time.sleep(min(8.0, 0.5 * (2 ** attempt)) + random.uniform(0.05, 0.35))

    print(f"GOLD_FETCH_RECOVERY_ENTER {url} last={type(last).__name__}:{last}", flush=True)
    with RECOVERY_GATE:
        for attempt in range(RECOVERY_ATTEMPTS):
            try:
                data = _fetch_once(url, timeout=min(75.0, 40.0 + attempt * 5.0))
                print(f"GOLD_FETCH_RECOVERY_PASS {url} attempt={attempt + 1}", flush=True)
                return data
            except urllib.error.HTTPError as e:
                if e.code in (404, 410):
                    print(f"GOLD_FETCH_RECOVERY_NOT_FOUND {url} code={e.code}", flush=True)
                    return None
                last = e
                retry_after = e.headers.get("Retry-After") if getattr(e, "headers", None) else None
                if retry_after:
                    try:
                        time.sleep(min(30.0, max(0.0, float(retry_after))))
                    except Exception:
                        pass
            except Exception as e:
                last = e
            if attempt + 1 < RECOVERY_ATTEMPTS:
                time.sleep(min(20.0, 1.0 * (2 ** attempt)) + random.uniform(0.1, 0.8))
    raise RuntimeError(
        f"download failed after {fast_attempts}+{RECOVERY_ATTEMPTS} attempts: {url}: {last}"
    )


def decode_jetta_ticks(blob: bytes):
    """Decode Dukascopy compact Jetta tick response into (ms, askTick, bidTick).

    Jetta stores a base timestamp/base prices plus delta arrays. The reconstruction
    mirrors dukascopy-node's public data-normaliser contract.
    """
    try:
        data = json.loads(blob)
    except Exception as e:
        raise ValueError(f"invalid Jetta JSON: {e}") from e
    times = data.get("times")
    asks = data.get("asks")
    bids = data.get("bids")
    av = data.get("askVolumes")
    bv = data.get("bidVolumes")
    if not all(isinstance(x, list) for x in (times, asks, bids, av, bv)):
        raise ValueError("invalid Jetta tick columns")
    n = len(times)
    if any(len(x) != n for x in (asks, bids, av, bv)):
        raise ValueError("Jetta tick column length mismatch")
    if n == 0:
        return [], float(data.get("multiplier", 0) or 0)
    timestamp = int(data["timestamp"])
    multiplier = float(data["multiplier"])
    if multiplier <= 0:
        raise ValueError("invalid Jetta multiplier")
    ask_units = round(float(data["ask"]) / multiplier)
    bid_units = round(float(data["bid"]) / multiplier)
    out = []
    prev = -1
    factor = multiplier * TICK_SCALE
    for i in range(n):
        delta = int(times[i])
        if delta < 0:
            raise ValueError("negative Jetta time delta")
        timestamp += delta
        ask_units += int(asks[i])
        bid_units += int(bids[i])
        if timestamp < prev:
            raise ValueError("non-monotonic Jetta tick time")
        prev = timestamp
        ask_tick = int(round(ask_units * factor))
        bid_tick = int(round(bid_units * factor))
        if ask_tick < bid_tick:
            raise ValueError("ask < bid in Jetta source")
        out.append((timestamp, ask_tick, bid_tick))
    return out, multiplier


def selected_tick(ask_tick: int, bid_tick: int, side: str) -> int:
    if side == "bid":
        return bid_tick
    if side == "ask":
        return ask_tick
    if side == "mid":
        return int(round((ask_tick + bid_tick) / 2.0))
    raise ValueError(side)


def aggregate_blob(blob: bytes, side: str):
    ticks, multiplier = decode_jetta_ticks(blob)
    bars = []
    cur_sec = None
    o = h = l = c = None
    for ms, ask_tick, bid_tick in ticks:
        sec = ms // 1000
        p = selected_tick(ask_tick, bid_tick, side)
        if cur_sec != sec:
            if cur_sec is not None:
                bars.append((cur_sec, o, h, l, c))
            cur_sec = sec
            o = h = l = c = p
        else:
            if p > h:
                h = p
            if p < l:
                l = p
            c = p
    if cur_sec is not None:
        bars.append((cur_sec, o, h, l, c))
    return bars, multiplier


def ref_bar(row):
    if isinstance(row, dict):
        t = row.get("openTime", row.get("time", row.get("t", row.get("timestamp"))))
        o = row.get("open", row.get("o"))
        h = row.get("high", row.get("h"))
        l = row.get("low", row.get("l"))
        c = row.get("close", row.get("c"))
    else:
        if len(row) < 5:
            return None
        t, o, h, l, c = row[:5]
    if None in (t, o, h, l, c):
        return None
    t = int(float(t))
    if t > 10_000_000_000:
        t //= 1000
    return (t, float(o), float(h), float(l), float(c))


def calibrate(reference_pack: pathlib.Path, day: dt.date, output: pathlib.Path):
    with gzip.open(reference_pack, "rt", encoding="utf-8") as f:
        payload = json.load(f)
    rows = payload.get("bars", payload if isinstance(payload, list) else [])
    refs = {}
    for row in rows:
        q = ref_bar(row)
        if q:
            refs[q[0]] = q[1:]
    if not refs:
        raise RuntimeError("reference pack contains no parseable bars")

    blobs = []
    for hour in range(24):
        b = fetch_bytes(hour_url(day, hour))
        if b:
            blobs.append((hour, b))
        if len(blobs) >= 4:
            break
    if not blobs:
        raise RuntimeError("no Jetta source hours available for calibration day")

    candidates = []
    multipliers = set()
    for side in ("bid", "ask", "mid"):
        compared = exact = 0
        abs_err = 0.0
        try:
            for _, blob in blobs:
                bars, mul = aggregate_blob(blob, side)
                multipliers.add(mul)
                for sec, o, h, l, c in bars:
                    rr = refs.get(sec)
                    if not rr:
                        continue
                    vals = (o / TICK_SCALE, h / TICK_SCALE, l / TICK_SCALE, c / TICK_SCALE)
                    compared += 1
                    err = max(abs(vals[i] - rr[i]) for i in range(4))
                    abs_err += err
                    if err <= 0.00051:
                        exact += 1
                    if compared >= 5000:
                        break
                if compared >= 5000:
                    break
        except Exception:
            continue
        if compared:
            candidates.append({
                "side": side,
                "compared": compared,
                "exact": exact,
                "exactRatio": exact / compared,
                "meanMaxError": abs_err / compared,
            })
    if not candidates:
        raise RuntimeError("no Jetta calibration candidate could be evaluated")
    candidates.sort(key=lambda x: (-x["exactRatio"], x["meanMaxError"], -x["compared"]))
    best = candidates[0]
    if best["compared"] < 100 or best["exactRatio"] < 0.90:
        raise RuntimeError("Jetta decoder failed verified-pack parity: " + json.dumps(candidates))
    result = {
        "schema": "renko-gold-calibration-v2",
        "provider": "Dukascopy",
        "transport": "https://jetta.dukascopy.com/v1/ticks/XAU-USD/{year}/{month}/{day}/{hour}",
        "instrumentCode": "XAU-USD",
        "referenceDate": day.isoformat(),
        "referencePack": str(reference_pack),
        "tickSize": 0.001,
        "priceSide": best["side"],
        "providerMultipliersObserved": sorted(multipliers),
        "exactRatio": best["exactRatio"],
        "compared": best["compared"],
        "candidates": candidates,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n")
    print("RENKO_GOLD_JETTA_CALIBRATION_PASS", json.dumps(result, separators=(",", ":")))


def build_month(year: int, month: int, outdir: pathlib.Path, side: str,
                start: dt.datetime, end: dt.datetime, workers: int):
    mstart = dt.datetime(year, month, 1, tzinfo=UTC)
    mend = dt.datetime(year + (month == 12), 1 if month == 12 else month + 1, 1, tzinfo=UTC) - dt.timedelta(microseconds=1)
    if mend < start or mstart > end:
        return None

    outdir.mkdir(parents=True, exist_ok=True)
    cachedir = outdir / f".source-{year:04d}-{month:02d}"
    cachedir.mkdir(exist_ok=True)
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
        p = cachedir / f"{day.isoformat()}-{hour:02d}.json"
        p.write_bytes(blob)
        return (day, hour, url, p, sha)

    source_rows = []
    with cf.ThreadPoolExecutor(max_workers=workers) as ex:
        for item in ex.map(one, specs):
            source_rows.append(item)
    source_rows.sort(key=lambda x: (x[0], x[1]))

    asset = outdir / f"xauusd-s1-{year:04d}-{month:02d}.csv.gz"
    bar_count = 0
    earliest = latest = None
    source_hours = not_found_hours = empty_hours = 0
    multipliers = set()
    provenance = hashlib.sha256()

    with open(asset, "wb") as rawout:
        with gzip.GzipFile(filename="", mode="wb", fileobj=rawout, compresslevel=9, mtime=0) as gz:
            gz.write(b"unix_second,open_tick,high_tick,low_tick,close_tick\n")
            for day, hour, url, p, sha in source_rows:
                if p is None:
                    not_found_hours += 1
                    continue
                source_hours += 1
                provenance.update(url.encode())
                provenance.update(b"\0")
                provenance.update(sha.encode())
                provenance.update(b"\n")
                blob = p.read_bytes()
                bars, mul = aggregate_blob(blob, side)
                multipliers.add(mul)
                if not bars:
                    empty_hours += 1
                for sec, o, h, l, c in bars:
                    if sec < int(start.timestamp()) or sec > int(end.timestamp()):
                        continue
                    gz.write(f"{sec},{o},{h},{l},{c}\n".encode())
                    bar_count += 1
                    if earliest is None:
                        earliest = sec
                    latest = sec
                p.unlink(missing_ok=True)
    try:
        cachedir.rmdir()
    except OSError:
        pass

    if bar_count == 0:
        asset.unlink(missing_ok=True)
        return None
    asset_sha = hashlib.sha256(asset.read_bytes()).hexdigest()
    info = {
        "schema": "renko-gold-month-v2",
        "provider": "Dukascopy",
        "transport": "Jetta compact hourly ticks",
        "instrumentCode": "XAU-USD",
        "symbol": "XAUUSD",
        "interval": "1s",
        "year": year,
        "month": month,
        "asset": asset.name,
        "format": "csv.gz",
        "priceEncoding": "integer-ticks",
        "tickSize": 0.001,
        "priceSide": side,
        "providerMultipliersObserved": sorted(multipliers),
        "barCount": bar_count,
        "earliestSecond": earliest,
        "latestSecond": latest,
        "sourceHours": source_hours,
        "emptySourceHours": empty_hours,
        "notFoundHours": not_found_hours,
        "sourceDigestSha256": provenance.hexdigest(),
        "assetSha256": asset_sha,
        "bytes": asset.stat().st_size,
    }
    print("RENKO_GOLD_MONTH_PASS", json.dumps(info, separators=(",", ":")), flush=True)
    return info


def backfill_year(args):
    outdir = pathlib.Path(args.output_dir)
    start = dt.datetime.fromisoformat(args.start.replace("Z", "+00:00"))
    end = dt.datetime.fromisoformat(args.end.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    months = []
    for month in range(1, 13):
        info = build_month(args.year, month, outdir, args.side, start, end, args.workers)
        if info:
            months.append(info)
    summary = {
        "schema": "renko-gold-year-v2",
        "provider": "Dukascopy",
        "transport": "Jetta compact hourly ticks",
        "instrumentCode": "XAU-USD",
        "year": args.year,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "priceSide": args.side,
        "tickSize": 0.001,
        "months": months,
        "barCount": sum(m["barCount"] for m in months),
        "bytes": sum(m["bytes"] for m in months),
    }
    sp = outdir / f"summary-{args.year}.json"
    sp.write_text(json.dumps(summary, indent=2) + "\n")
    if 2003 <= args.year <= 2026 and not months:
        raise RuntimeError(f"year {args.year} produced no history")
    print("RENKO_GOLD_YEAR_PASS", json.dumps(summary, separators=(",", ":")), flush=True)


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
    b.add_argument("--start", default=ORIGIN.isoformat())
    b.add_argument("--end", default=DEFAULT_END.isoformat())
    b.add_argument("--workers", type=int, default=6)
    b.add_argument("--output-dir", required=True)
    a = p.parse_args()
    if a.cmd == "calibrate":
        calibrate(pathlib.Path(a.reference_pack), dt.date.fromisoformat(a.date), pathlib.Path(a.output))
    else:
        backfill_year(a)


if __name__ == "__main__":
    main()
