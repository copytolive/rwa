from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

# This runner intentionally imports the canonical GOLD24 engine rather than
# reimplementing it. That keeps signals, pending-order semantics, cost model,
# same-bar SL/TP handling, and metric calculation identical to the backtest.
GOLD24_DIR = Path(__file__).resolve().parents[1]
if str(GOLD24_DIR) not in sys.path:
    sys.path.insert(0, str(GOLD24_DIR))

from core import Candidate, audit_dataset, backtest_candidate  # noqa: E402

STANDARD_LOT_GOLD_UNITS = 100.0

def run_candidate(candidate: Candidate, expected: dict[str, float | int | str]) -> dict:
    p = argparse.ArgumentParser(
        description="Exact canonical GOLD24 qty=100 re-backtest for one strict-qualified method."
    )
    p.add_argument("--state-dir", default=".gold24-canonical-v11")
    p.add_argument("--json-out")
    p.add_argument(
        "--no-assert",
        action="store_true",
        help="Run without checking the frozen reference metrics/config hash.",
    )
    args = p.parse_args()

    state = Path(args.state_dir).resolve()
    dataset = state / "gate_a" / "GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"
    receipt = state / "gate_a" / "gate_a_receipt.json"

    d, audit = audit_dataset(dataset, receipt, candidate.timeframe)
    result = backtest_candidate(d, candidate, flat_lot=STANDARD_LOT_GOLD_UNITS)
    m = result["metrics"]

    payload = {
        "status": "PASS",
        "method": expected["method"],
        "config_hash": result["config_hash"],
        "candidate": result["candidate"],
        "quantity_gold_units": STANDARD_LOT_GOLD_UNITS,
        "xauusd_standard_lot_reference": 1.0,
        "dataset_audit": audit,
        "metrics": m,
        "execution_hash": result["execution_hash"],
        "reference": expected,
        "parity_note": (
            "Exact Python parity uses the canonical TradingView COMEX:GC1! D1 dataset "
            "and the canonical stressed Hyperliquid cost model. It is not broker-specific "
            "MT5/Exness cost parity."
        ),
    }

    if not args.no_assert:
        if result["config_hash"] != expected["config_hash"]:
            raise SystemExit(
                f"PARITY_FAIL config_hash {result['config_hash']} != {expected['config_hash']}"
            )

        checks = {
            "trades": (int(m["trades"]), int(expected["trades"]), 0.0),
            "net_profit": (float(m["net_profit"]), float(expected["net_profit_usd"]), 1e-6),
            "profit_factor": (float(m["profit_factor"]), float(expected["profit_factor"]), 1e-9),
            "wr": (float(m["wr"]), float(expected["win_rate_pct"]), 1e-9),
            "expectancy": (float(m["expectancy"]), float(expected["ev_per_trade_usd"]), 1e-9),
            "max_dd_pct": (float(m["max_dd_pct"]), float(expected["max_dd_pct"]), 1e-9),
            "sqn": (float(m["sqn"]), float(expected["sqn"]), 1e-9),
        }
        for name, (actual, ref, tol) in checks.items():
            if isinstance(actual, int):
                ok = actual == ref
            else:
                ok = math.isclose(actual, ref, rel_tol=0.0, abs_tol=tol)
            if not ok:
                raise SystemExit(f"PARITY_FAIL {name}: actual={actual} reference={ref}")
        payload["reference_assertions"] = "PASS"

    text = json.dumps(payload, indent=2, sort_keys=True, default=str)
    if args.json_out:
        Path(args.json_out).write_text(text + "\n")
    print(text)
    return payload
