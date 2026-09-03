from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

GOLD24_DIR = Path(__file__).resolve().parents[1]
if str(GOLD24_DIR) not in sys.path:
    sys.path.insert(0, str(GOLD24_DIR))

from core import Candidate, audit_dataset, backtest_candidate  # noqa:E402

STANDARD_LOT_GOLD_UNITS = 100.0

def run_candidate(candidate: Candidate, expected: dict) -> dict:
    p=argparse.ArgumentParser(description="Exact native-H4 GOLD10B qty=100 replay")
    p.add_argument("--state-dir", default=".gold10b-native-h4")
    p.add_argument("--json-out")
    p.add_argument("--no-assert", action="store_true")
    a=p.parse_args()
    state=Path(a.state_dir).resolve()
    dataset=state/"GC1_COMEX_TRADINGVIEW_H4_PRIMARY.csv"
    receipt=state/"gate_a_h4_receipt.json"
    d,audit=audit_dataset(dataset,receipt,"H4")
    if candidate.timeframe!="H4":
        raise SystemExit("PARITY_FAIL candidate timeframe is not H4")
    res=backtest_candidate(d,candidate,flat_lot=STANDARD_LOT_GOLD_UNITS)
    m=res["metrics"]
    payload={
        "status":"PASS","method":expected["method"],"config_hash":res["config_hash"],
        "candidate":res["candidate"],"quantity_gold_units":STANDARD_LOT_GOLD_UNITS,
        "xauusd_standard_lot_reference":1.0,"dataset_audit":audit,"metrics":m,
        "execution_hash":res["execution_hash"],"reference":expected,
        "parity_note":"Exact Python replay uses direct source-native TradingView COMEX:GC1! H4 bars; no H4 resampling."
    }
    if not a.no_assert:
        if res["config_hash"]!=expected["config_hash"]:
            raise SystemExit(f"PARITY_FAIL config_hash {res['config_hash']} != {expected['config_hash']}")
        checks={
            "trades":(int(m["trades"]),int(expected["trades"]),0.0),
            "net_profit":(float(m["net_profit"]),float(expected["net_profit_usd"]),1e-6),
            "profit_factor":(float(m["profit_factor"]),float(expected["profit_factor"]),1e-9),
            "wr":(float(m["wr"]),float(expected["win_rate_pct"]),1e-9),
            "expectancy":(float(m["expectancy"]),float(expected["ev_per_trade_usd"]),1e-9),
            "max_dd_pct":(float(m["max_dd_pct"]),float(expected["max_dd_pct"]),1e-9),
            "sqn":(float(m["sqn"]),float(expected["sqn"]),1e-9),
        }
        for name,(actual,ref,tol) in checks.items():
            ok=(actual==ref) if tol==0 else math.isclose(actual,ref,rel_tol=0.0,abs_tol=tol)
            if not ok: raise SystemExit(f"PARITY_FAIL {name}: actual={actual} reference={ref}")
        payload["reference_assertions"]="PASS"
    text=json.dumps(payload,indent=2,sort_keys=True,default=str)
    if a.json_out: Path(a.json_out).write_text(text+"\n",encoding="utf-8")
    print(text)
    return payload
