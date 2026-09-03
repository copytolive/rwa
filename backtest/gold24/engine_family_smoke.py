from __future__ import annotations
import argparse, json, random, sys
from pathlib import Path
import numpy as np

HERE=Path(__file__).resolve().parent
if str(HERE) not in sys.path: sys.path.insert(0,str(HERE))
from core import FAMILIES, audit_dataset, backtest_candidate, signal_series
from multimethod_v1_discovery import _fresh_candidate_for_family

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--state-dir",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    state=Path(a.state_dir)
    d,audit=audit_dataset(state/"gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv",state/"gate_a/gate_a_receipt.json","D1")
    rows=[]
    failures=[]
    for idx,family in enumerate(sorted(FAMILIES)):
        rng=random.Random(202609030000+idx)
        c=_fresh_candidate_for_family(rng,family)
        try:
            sig=signal_series(d,c)
            r=backtest_candidate(d,c,flat_lot=1.0)
            causal=True
            causal_checks=[]
            for frac in (0.70,0.80,0.90):
                cut=int(len(d)*frac)
                dt=d.iloc[:cut].reset_index(drop=True)
                short=signal_series(dt,c)
                # Compare only after full warmup and before cut.
                warm=min(max(150,c.slow*2+2 if "ICHIMOKU" in family else c.slow+2),cut)
                same=bool(np.array_equal(sig[warm:cut],short[warm:cut]))
                causal_checks.append({"cut":cut,"same_prefix":same})
                causal=causal and same
            row={
                "family":family,
                "config_hash":c.config_hash,
                "signal_nonzero":int(np.count_nonzero(sig)),
                "trades":int(r.get("metrics",{}).get("trades",0) or 0),
                "execution_hash":str(r.get("execution_hash") or ""),
                "causal_prefix_pass":causal,
                "causal_checks":causal_checks,
            }
            if not causal:
                failures.append({"family":family,"reason":"causal prefix mismatch"})
            rows.append(row)
        except Exception as e:
            failures.append({"family":family,"reason":repr(e)})
    payload={
        "status":"PASS" if not failures else "FAIL",
        "schema":"gold24-engine-family-smoke-v2",
        "dataset_rows":int(audit["rows"]),
        "dataset_sha256":audit["dataset_sha256"],
        "implemented_family_count":len(FAMILIES),
        "tested_family_count":len(rows),
        "all_implemented_families_executed":len(rows)==len(FAMILIES) and not failures,
        "failures":failures,
        "rows":rows,
        "data_blocked_native_mtf":["H4_D1_MTF_NATIVE","D1_H4_PULLBACK_NATIVE"],
        "note":"Blocked native-MTF families are intentionally not executed until real canonical H4 data exists."
    }
    Path(a.out).write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps(payload,indent=2))
    if failures:
        raise SystemExit(1)

if __name__=="__main__":
    main()
