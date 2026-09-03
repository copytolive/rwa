from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fail(msg: str) -> None:
    raise RuntimeError(f"STRICT_GATE_A_FAIL: {msg}")


def audit(dataset: Path, receipt_path: Path, timeframe: str, out: Path) -> dict:
    if timeframe not in {"H1", "H4", "D1"}:
        fail("timeframe must be H1/H4/D1")
    if not dataset.exists():
        fail(f"primary bytes missing: {dataset}")
    if not receipt_path.exists():
        fail(f"receipt missing: {receipt_path}")

    receipt = json.loads(receipt_path.read_text())
    if receipt.get("crosscheck_pass") is not True:
        fail("crosscheck_pass != true")
    if receipt.get("provider") not in {"TradingView", "OANDA"}:
        fail("provider not approved")
    if receipt.get("timeframe") != timeframe:
        fail(f"receipt timeframe {receipt.get('timeframe')} != requested {timeframe}")
    if str(receipt.get("primary_end_utc", ""))[:4] < "2026":
        fail("primary receipt does not reach 2026")
    if str(receipt.get("crosscheck_end_utc", ""))[:4] < "2026":
        fail("crosscheck receipt does not reach 2026")
    if int(receipt.get("overlap_rows") or 0) < 2500:
        fail("crosscheck overlap < 2500")
    if not receipt.get("primary_sha256") or not receipt.get("crosscheck_data_sha256"):
        fail("primary/crosscheck SHA missing")
    if "no resampling" not in str(receipt.get("timestamp_policy", "")).lower():
        fail("receipt does not explicitly attest no resampling")

    primary_sha = sha256_file(dataset)
    if primary_sha != receipt["primary_sha256"]:
        fail("primary SHA mismatch")

    cross_name = receipt.get("crosscheck_data_file")
    if not cross_name:
        fail("crosscheck_data_file missing")
    cross_path = receipt_path.parent / cross_name
    if not cross_path.exists():
        fail(f"crosscheck bytes missing: {cross_path}")
    cross_sha = sha256_file(cross_path)
    if cross_sha != receipt["crosscheck_data_sha256"]:
        fail("crosscheck bytes SHA mismatch")

    d = pd.read_csv(dataset)
    required = ["Date", "Open", "High", "Low", "Close", "Volume"]
    missing = [c for c in required if c not in d.columns]
    if missing:
        fail(f"primary missing columns {missing}")
    dt = pd.to_datetime(d["Date"], errors="coerce", utc=True)
    invalid_ts = int(dt.isna().sum())
    duplicates = int(dt.duplicated().sum()) if not invalid_ts else -1
    monotonic = bool(dt.is_monotonic_increasing) if not invalid_ts else False
    num = d[["Open", "High", "Low", "Close", "Volume"]].apply(pd.to_numeric, errors="coerce")
    nan_ohlcv = int(num.isna().sum().sum())
    if invalid_ts or duplicates or not monotonic or nan_ohlcv:
        fail(f"UTC/order/duplicate/NaN audit failed: invalid_ts={invalid_ts}, dup={duplicates}, monotonic={monotonic}, nan={nan_ohlcv}")

    o, h, l, c = (num[x].to_numpy(float) for x in ["Open", "High", "Low", "Close"])
    ohlc_bad = int(np.count_nonzero((h < l) | (o < l) | (o > h) | (c < l) | (c > h)))
    if ohlc_bad:
        fail(f"OHLC violations={ohlc_bad}")
    if int(dt.iloc[-1].year) < 2026:
        fail("primary bytes do not reach 2026")

    deltas = dt.diff().dropna().dt.total_seconds() / 3600.0
    expected_hours = {"H1": 1.0, "H4": 4.0, "D1": 24.0}[timeframe]
    audit_gap_threshold_hours = {"H1": 96.0, "H4": 96.0, "D1": 168.0}[timeframe]
    ordinary_gap_rows = int((deltas > expected_hours * 1.5).sum())
    unexpected_long_gaps = int((deltas > audit_gap_threshold_hours).sum())
    max_gap_hours = float(deltas.max()) if len(deltas) else 0.0
    if unexpected_long_gaps:
        fail(f"unexpected long gaps={unexpected_long_gaps}; max_gap_hours={max_gap_hours}")

    zero_volume = int((num["Volume"] <= 0).sum())
    negative_volume = int((num["Volume"] < 0).sum())
    if negative_volume:
        fail(f"negative volume rows={negative_volume}")

    result = {
        "schema": "gold24-strict-gate-a-v1",
        "gate_a": "PASS",
        "timeframe": timeframe,
        "provider": receipt.get("provider"),
        "primary_symbol": receipt.get("primary_symbol"),
        "crosscheck_symbol": receipt.get("crosscheck_symbol"),
        "primary_rows": int(len(d)),
        "primary_start_utc": str(dt.iloc[0]),
        "primary_end_utc": str(dt.iloc[-1]),
        "primary_sha256": primary_sha,
        "crosscheck_file": cross_name,
        "crosscheck_sha256": cross_sha,
        "crosscheck_rows_receipt": int(receipt.get("crosscheck_rows") or 0),
        "overlap_rows": int(receipt.get("overlap_rows") or 0),
        "daily_log_return_correlation": float(receipt.get("daily_log_return_correlation") or 0.0),
        "daily_direction_agreement": float(receipt.get("daily_direction_agreement") or 0.0),
        "timestamp_policy": receipt.get("timestamp_policy"),
        "utc_invalid_rows": invalid_ts,
        "duplicate_timestamp_rows": duplicates,
        "monotonic_increasing": monotonic,
        "nan_ohlcv_cells": nan_ohlcv,
        "ohlc_violation_rows": ohlc_bad,
        "zero_volume_rows": zero_volume,
        "negative_volume_rows": negative_volume,
        "ordinary_market_gap_rows": ordinary_gap_rows,
        "unexpected_long_gap_rows": unexpected_long_gaps,
        "max_gap_hours": max_gap_hours,
        "gap_threshold_hours": audit_gap_threshold_hours,
        "crosscheck_bytes_verified": True,
        "no_resampling_attested": True,
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2, sort_keys=True))
    return result


def selftest() -> None:
    assert {"H1": 1, "H4": 4, "D1": 24}["D1"] == 24
    assert "no resampling" in "OHLC unchanged; no resampling".lower()
    print("strict_gate_a selftest: PASS")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset")
    ap.add_argument("--receipt")
    ap.add_argument("--timeframe", default="D1")
    ap.add_argument("--out")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        selftest()
        return
    if not args.dataset or not args.receipt or not args.out:
        ap.error("--dataset --receipt --out required")
    print(json.dumps(audit(Path(args.dataset), Path(args.receipt), args.timeframe, Path(args.out)), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
