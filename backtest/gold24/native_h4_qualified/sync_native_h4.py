from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
GOLD24=HERE.parent
QUAL=GOLD24/"qualified_scripts"
for p in (GOLD24,QUAL,HERE):
    if str(p) not in sys.path: sys.path.insert(0,str(p))

from core import Candidate  # noqa:E402
from family_codes import FAMILY_CODES  # noqa:E402

PIP_SIZE_USD=0.01

def load(p:Path)->dict:
    return json.loads(p.read_text(encoding="utf-8"))

def py_text(c:Candidate,row:dict)->str:
    expected={
        "method":row["method"],"config_hash":row["config_hash"],
        "trades":int(row["total_entry"]),
        "win_rate_pct":float(row["standard_lot_win_rate_pct"]),
        "profit_factor":float(row["standard_lot_profit_factor_same_cost_model"]),
        "net_profit_usd":float(row["standard_lot_net_profit_usd_same_cost_model"]),
        "ev_per_trade_usd":float(row["standard_lot_ev_per_trade_usd_same_cost_model"]),
        "max_dd_pct":float(row["standard_lot_max_dd_pct_starting_equity_10000"]),
        "sqn":float(row["standard_lot_sqn_same_cost_model"]),
        "sl_pips":float(row["sl_pips"]),"tp_pips":float(row["tp_pips"]),
        "oos_pf":float(row["oos_profit_factor"]),
        "monte_carlo_pass":bool(row["monte_carlo_pass"]),
        "mc_95pct_max_drawdown_pct":float(row["mc_95pct_max_drawdown_pct"]),
        "positive_years_pct":float(row["positive_years_pct"]),
        "worst_year":int(row["worst_year"]),
        "history_years":float(row["history_years"]),
    }
    return (
        "from common_h4 import Candidate, run_candidate\n"
        f"CANDIDATE=Candidate(symbol='GOLD',timeframe='H4',family={c.family!r},fast={c.fast},slow={c.slow},"
        f"p1={float(c.p1)!r},p2={float(c.p2)!r},p3={float(c.p3)!r},entry_method={c.entry_method!r},"
        f"direction_mode={c.direction_mode!r},sl={float(c.sl)!r},tp={float(c.tp)!r},offset={float(c.offset)!r},expiry={c.expiry})\n"
        f"EXPECTED={json.dumps(expected,separators=(',',':'))}\n"
        "if __name__=='__main__': run_candidate(CANDIDATE,EXPECTED)\n"
    )

def mq5_text(c:Candidate,row:dict,ordinal:int)->str:
    code=FAMILY_CODES[c.family]
    magic=24800000+(int(row["config_hash"][:8],16)%700000)
    lines=[
        "#property strict",'#property version "1.00"',
        '#property description "GOLD10B native H4 exact canonical translation"',
        f"// {row['method']} | hash {row['config_hash']}",
        f"#define QM_FAMILY_CODE {code}",f"#define QM_FAST {c.fast}",f"#define QM_SLOW {c.slow}",
        f"#define QM_P1 {float(c.p1)}",f"#define QM_P2 {float(c.p2)}",f"#define QM_P3 {float(c.p3)}",
        f"#define QM_SL_USD {float(c.sl)}",f"#define QM_TP_USD {float(c.tp)}",f"#define QM_OFFSET_USD {float(c.offset)}",
        f"#define QM_EXPIRY_BARS {c.expiry}",f'#define QM_DIRECTION_MODE "{c.direction_mode}"',
        f'#define QM_ENTRY_METHOD "{c.entry_method}"',f'#define QM_CONFIG_HASH "{row["config_hash"]}"',
        f"#define QM_MAGIC {magic}",f'#define QM_TAG "GOLD10B_H4_{ordinal:03d}"',
        '#include "native_h4_engine.mqh"',""
    ]
    return "\n".join(lines)

def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--cross-json",required=True)
    ap.add_argument("--h4-json",required=True)
    ap.add_argument("--out-dir",default=str(HERE))
    a=ap.parse_args()
    cross=load(Path(a.cross_json)); h4=load(Path(a.h4_json))
    if cross.get("status")!="PASS": raise SystemExit("cross-timeframe proof is not PASS")
    selected_hashes={
        str(r["config_hash"]) for r in cross.get("selected",[])
        if str(r.get("timeframe"))=="H4" and str(r.get("classification"))=="HARD PASS"
    }
    h4_rows={str(r["config_hash"]):r for r in h4.get("hard_pass_rows",[])}
    missing=sorted(selected_hashes-set(h4_rows))
    if missing: raise RuntimeError(f"selected H4 hard-pass rows missing from H4 source result: {missing}")
    out=Path(a.out_dir); out.mkdir(parents=True,exist_ok=True)
    # Remove only generated wrappers from prior native-H4 selected sets.
    for p in list(out.glob("h4_*.py"))+list(out.glob("h4_*.mq5")):
        p.unlink()
    methods=[]
    for ordinal,h in enumerate(sorted(selected_hashes),1):
        row=h4_rows[h]
        c=Candidate(**row["candidate"])
        if c.timeframe!="H4" or c.config_hash!=h: raise RuntimeError(f"H4 candidate/hash mismatch {h}")
        if c.family not in FAMILY_CODES: raise RuntimeError(f"family not MT5 registered: {c.family}")
        stem=f"h4_{c.family.lower()}_{h[:12]}"
        py=out/f"{stem}.py"; mq=out/f"{stem}.mq5"
        py.write_text(py_text(c,row),encoding="utf-8")
        mq.write_text(mq5_text(c,row,ordinal),encoding="utf-8")
        methods.append({
            "stem":stem,"method":row["method"],"family":c.family,"timeframe":"H4",
            "config_hash":h,"python":py.name,"mt5":mq.name,
            "sl_pips":float(row["sl_pips"]),"tp_pips":float(row["tp_pips"]),
            "total_entry":int(row["total_entry"]),
            "python_expected_metrics":{
                "wr_pct":float(row["standard_lot_win_rate_pct"]),
                "pf_net":float(row["standard_lot_profit_factor_same_cost_model"]),
                "net_profit_usd":float(row["standard_lot_net_profit_usd_same_cost_model"]),
                "ev_trade_usd":float(row["standard_lot_ev_per_trade_usd_same_cost_model"]),
                "max_dd_pct":float(row["standard_lot_max_dd_pct_starting_equity_10000"]),
                "sqn":float(row["standard_lot_sqn_same_cost_model"]),
            }
        })
    payload={
        "status":"PASS","source_h4_run_id":cross.get("source_h4_run_id"),
        "selected_h4_hardpass_count":len(methods),"methods":methods,
        "contract":{
            "pip_size_usd":0.01,"quantity_gold_units":100.0,"timeframe":"H4",
            "python":"exact core.py native-H4 replay with frozen expected metrics/config hash",
            "mt5":"native H4 engine/include; parameter/config hash identical to Python; requires native MetaEditor compile + Strategy Tester PASS before VERIFIED",
        }
    }
    (out/"selected_manifest_h4.json").write_text(json.dumps(payload,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(json.dumps(payload,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())
