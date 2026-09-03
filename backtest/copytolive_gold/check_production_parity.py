#!/usr/bin/env python3
"""Validate exact CopyToLive production replay against the captured farm metrics."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

TOLERANCES = {
    "totalTrades": 0.0,
    "winRate": 0.11,
    "profitFactor": 0.011,
    "netProfit": 0.51,
    "maxDrawdown": 0.11,
    "sqn": 0.011,
    "recoveryFactor": 0.011,
}


def build_evidence(result_path: Path, data_path: Path, rwa_ref: str) -> dict:
    result = json.loads(result_path.read_text())
    rows = result.get("rows") or []
    if len(rows) != 118:
        raise RuntimeError(f"expected 118 replay rows, got {len(rows)}")

    parity_by_metric = {k: 0 for k in TOLERANCES}
    max_abs_delta = {k: 0.0 for k in TOLERANCES}
    worst_delta = {k: None for k in TOLERANCES}
    exact_all = 0

    for row in rows:
        ok = True
        parity = row.get("Parity") or {}
        for key, tolerance in TOLERANCES.items():
            item = parity.get(key)
            if item is None:
                ok = False
                continue
            delta = abs(float(item["delta"]))
            if delta <= tolerance:
                parity_by_metric[key] += 1
            else:
                ok = False
            if delta > max_abs_delta[key]:
                max_abs_delta[key] = delta
                worst_delta[key] = {
                    "method": row["Metode"],
                    "expected": item["expected"],
                    "actual": item["actual"],
                    "delta": item["delta"],
                }
        exact_all += int(ok)

    evidence = {
        "status": "PASS" if exact_all == 118 else "PARITY_MISMATCH",
        "rwa_ref": rwa_ref,
        "strategies": 118,
        "parity_exact_all_metrics": exact_all,
        "parity_by_metric": parity_by_metric,
        "max_abs_delta": max_abs_delta,
        "worst_delta": worst_delta,
        "dataset": {
            "source": "CopyToLive production VPS GOLD_H1.parquet",
            "path_on_vps": "/home/opentrue-platform/backend/trading-service/data/ohlcv/GOLD_H1.parquet",
            "sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
            "bytes": data_path.stat().st_size,
            "rows": result["dataset_rows"],
            "start": result["dataset_start"],
            "end": result["dataset_end"],
        },
        "base_gate_pass": result["base_gate_pass"],
        "monte_carlo_pass": result["monte_carlo_pass"],
        "corr_kept": result["corr_kept"],
        "strict_final_pass": result["strict_final_pass"],
        "source_farm_sha256": result["source_farm_sha256"],
        "source_state_sha256": result["source_state_sha256"],
        "source_engine_sha256": result["source_engine_sha256"],
    }
    return evidence


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--result", required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--rwa-ref", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--require-exact", action="store_true")
    args = ap.parse_args()

    evidence = build_evidence(Path(args.result), Path(args.data), args.rwa_ref)
    Path(args.out).write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n")
    print(json.dumps(evidence, indent=2, sort_keys=True))
    if args.require_exact and evidence["status"] != "PASS":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
