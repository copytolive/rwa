#!/usr/bin/env python3
"""Build one canonical GOLD year with source-hour status evidence.

This is a thin orchestration layer around renko_gold_full_backfill.py. It keeps the
already-verified decoder/aggregator unchanged, records whether each requested
Dukascopy Jetta hour was active, provider-empty, expected market-closed, or
unavailable, and writes a small year summary beside the monthly gzip assets.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import pathlib
import threading
from zoneinfo import ZoneInfo

HERE = pathlib.Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("gold_builder", HERE / "renko_gold_full_backfill.py")
GOLD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(GOLD)
UTC = dt.timezone.utc
NY = ZoneInfo("America/New_York")
ORIGIN = dt.datetime(2003, 5, 5, tzinfo=UTC)


def parse_hour_url(url: str) -> dt.datetime:
    p = url.rstrip("/").split("/")
    y, m, d, h = map(int, p[-4:])
    return dt.datetime(y, m, d, h, tzinfo=UTC)


def expected_market_closed(hour_utc: dt.datetime) -> bool:
    """Deterministic XAU session classifier using New York trading clock.

    Expected closure is the daily 17:00 ET maintenance hour plus the weekend
    closure from Friday 17:00 ET until Sunday 18:00 ET. Provider-confirmed empty
    hours outside this schedule remain explicitly classified provider-empty.
    """
    n = hour_utc.astimezone(NY)
    wd, hour = n.weekday(), n.hour
    if wd == 4 and hour >= 17:
        return True
    if wd == 5:
        return True
    if wd == 6 and hour < 18:
        return True
    if hour == 17:
        return True
    return False


def compress_hours(hours: list[str]) -> list[dict]:
    if not hours:
        return []
    vals = sorted(dt.datetime.fromisoformat(x.replace("Z", "+00:00")) for x in set(hours))
    out = []
    start = prev = vals[0]
    for cur in vals[1:]:
        if cur == prev + dt.timedelta(hours=1):
            prev = cur
            continue
        out.append({"start": start.isoformat().replace("+00:00", "Z"), "end": prev.isoformat().replace("+00:00", "Z"), "hours": int((prev-start).total_seconds()//3600)+1})
        start = prev = cur
    out.append({"start": start.isoformat().replace("+00:00", "Z"), "end": prev.isoformat().replace("+00:00", "Z"), "hours": int((prev-start).total_seconds()//3600)+1})
    return out


def build_year(year: int, side: str, start: dt.datetime, end: dt.datetime, workers: int, outdir: pathlib.Path):
    outdir.mkdir(parents=True, exist_ok=True)
    original_fetch = GOLD.fetch_bytes
    status_lock = threading.Lock()
    statuses: dict[str, str] = {}

    def recording_fetch(url: str, retries: int = 5):
        blob = original_fetch(url, retries)
        if blob is None:
            state = "unavailable"
        else:
            try:
                payload = json.loads(blob)
                state = "active" if isinstance(payload.get("times"), list) and len(payload.get("times")) else "empty"
            except Exception:
                state = "invalid"
        with status_lock:
            statuses[url] = state
        return blob

    GOLD.fetch_bytes = recording_fetch
    months = []
    try:
        for month in range(1, 13):
            mstart = dt.datetime(year, month, 1, tzinfo=UTC)
            mend = dt.datetime(year + (month == 12), 1 if month == 12 else month + 1, 1, tzinfo=UTC) - dt.timedelta(microseconds=1)
            if mend < start or mstart > end:
                continue
            with status_lock:
                statuses.clear()
            info = GOLD.build_month(year, month, outdir, side, start, end, workers)
            with status_lock:
                observed = dict(statuses)
            if not info:
                raise RuntimeError(f"requested month {year:04d}-{month:02d} produced no bars")
            market_closed, provider_empty, unavailable, invalid = [], [], [], []
            active = 0
            for url, state in sorted(observed.items()):
                h = parse_hour_url(url)
                key = h.isoformat().replace("+00:00", "Z")
                if state == "active":
                    active += 1
                elif state == "empty":
                    (market_closed if expected_market_closed(h) else provider_empty).append(key)
                elif state == "unavailable":
                    unavailable.append(key)
                else:
                    invalid.append(key)
            if invalid:
                raise RuntimeError(f"invalid source payload hours in {year:04d}-{month:02d}: {invalid[:5]}")
            if len(unavailable) != int(info.get("notFoundHours", -1)):
                raise RuntimeError("source unavailable count mismatch")
            if len(market_closed) + len(provider_empty) != int(info.get("emptySourceHours", -1)):
                raise RuntimeError("source empty count mismatch")
            info.update({
                "sourceStatusSchema": "dukascopy-hour-status-v1",
                "activeSourceHours": active,
                "marketClosedHours": len(market_closed),
                "providerEmptyHours": len(provider_empty),
                "sourceUnavailableHours": len(unavailable),
                "marketClosedHourRanges": compress_hours(market_closed),
                "providerEmptyHourRanges": compress_hours(provider_empty),
                "sourceUnavailableHourRanges": compress_hours(unavailable),
            })
            months.append(info)
    finally:
        GOLD.fetch_bytes = original_fetch

    summary = {
        "schema": "renko-gold-year-v3",
        "provider": "Dukascopy",
        "transport": "Jetta compact hourly ticks",
        "instrumentCode": "XAU-USD",
        "symbol": "XAUUSD",
        "interval": "1s",
        "year": year,
        "start": start.isoformat().replace("+00:00", "Z"),
        "end": end.isoformat().replace("+00:00", "Z"),
        "priceSide": side,
        "tickSize": 0.001,
        "months": months,
        "barCount": sum(int(m["barCount"]) for m in months),
        "bytes": sum(int(m["bytes"]) for m in months),
        "sourceHours": sum(int(m["sourceHours"]) for m in months),
        "marketClosedHours": sum(int(m["marketClosedHours"]) for m in months),
        "providerEmptyHours": sum(int(m["providerEmptyHours"]) for m in months),
        "sourceUnavailableHours": sum(int(m["sourceUnavailableHours"]) for m in months),
    }
    path = outdir / f"summary-{year}.json"
    path.write_text(json.dumps(summary, indent=2) + "\n")
    print("RENKO_GOLD_YEAR_STATUS_PASS", json.dumps({k:v for k,v in summary.items() if k != "months"}, separators=(",", ":")), flush=True)
    return path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--year", type=int, required=True)
    p.add_argument("--side", choices=["bid", "ask", "mid"], required=True)
    p.add_argument("--start", default=ORIGIN.isoformat())
    p.add_argument("--end", required=True)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--output-dir", required=True)
    a = p.parse_args()
    start = dt.datetime.fromisoformat(a.start.replace("Z", "+00:00"))
    end = dt.datetime.fromisoformat(a.end.replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    if end.tzinfo is None:
        end = end.replace(tzinfo=UTC)
    build_year(a.year, a.side, start.astimezone(UTC), end.astimezone(UTC), a.workers, pathlib.Path(a.output_dir))


if __name__ == "__main__":
    main()
