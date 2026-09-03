from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import numpy as np

from core import Candidate, FAMILIES, audit_dataset, backtest_candidate, pearson_log_equity, validate_candidate
import multimethod_v1_discovery as impl

_D=None

WINDOWS=[2,3,4,5,6,7,8,10,12,13,14,16,20,21,26,34,50,55,89]
SLTP=[5.0,7.5,10.0,12.5,15.0,17.5,20.0,22.5,25.0]
OFFSETS=[0.25,0.5,0.75,1.0,1.25,1.5,2.0,2.5,3.0,4.0]
EXPIRY=[1,2,3,4,5,6,8,10,12]


def _init(dataset:str,receipt:str)->None:
    global _D
    _D,_=audit_dataset(dataset,receipt,"H4")


def _candidate(rng:random.Random,family:str)->Candidate:
    fast,slow=sorted(rng.sample(WINDOWS,2))
    p1,p2,p3=impl._family_params(rng,family,None)
    sl=float(rng.choice(SLTP))
    if rng.random()<0.78:
        t=[x for x in SLTP if x>=sl]
        tp=float(rng.choice(t or SLTP))
    else:
        tp=float(rng.choice(SLTP))
    c=Candidate(
        symbol="GOLD",timeframe="H4",family=family,
        fast=int(fast),slow=int(slow),p1=float(p1),p2=float(p2),p3=float(p3),
        entry_method="LIMIT" if rng.random()<0.88 else "STOP",
        direction_mode="BOTH" if rng.random()<0.72 else "LONG_ONLY",
        sl=sl,tp=tp,offset=float(rng.choice(OFFSETS)),expiry=int(rng.choice(EXPIRY)),
    )
    validate_candidate(c)
    return c


def _worker(cdict:dict)->dict:
    if _D is None: raise RuntimeError("worker H4 dataset missing")
    c=Candidate(**cdict)
    r=backtest_candidate(_D,c,flat_lot=100.0)
    m=r.get("metrics",{})
    trades=int(m.get("trades",0) or 0)
    net=float(m.get("net_profit",0.0) or 0.0)
    pf=float(m.get("profit_factor",0.0) or 0.0)
    dd=float(m.get("max_dd_pct",1e9) or 1e9)
    ev=float(m.get("expectancy",0.0) or 0.0)
    basic_candidate=trades>=100 and net>=20000.0
    primitive=trades>=300 and net>=20000.0 and pf>=1.20 and dd<=25.0 and ev>0.0
    return {"candidate":c.canonical_dict(),"config_hash":c.config_hash,"candidate_gate_pre_corr":basic_candidate,
            "keep":primitive,"trades":trades,"net_profit_usd":net,"pf":pf,"max_dd_pct":dd,"ev_per_trade_usd":ev}


def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--state-dir",required=True)
    ap.add_argument("--out",required=True)
    ap.add_argument("--candidate-count",type=int,default=60000)
    ap.add_argument("--workers",type=int,default=8)
    ap.add_argument("--seed",type=int,default=2026090404)
    a=ap.parse_args()
    state=Path(a.state_dir)
    dataset=state/"GC1_COMEX_TRADINGVIEW_H4_PRIMARY.csv"
    receipt=state/"gate_a_h4_receipt.json"
    d,audit=audit_dataset(dataset,receipt,"H4")

    families=sorted(FAMILIES)
    rng=random.Random(a.seed)
    generated=[]
    seen=set()
    family_counts=Counter()
    attempts=0
    while len(generated)<a.candidate_count and attempts<a.candidate_count*50:
        attempts+=1
        family=families[len(generated)%len(families)] if rng.random()<0.65 else rng.choice(families)
        c=_candidate(rng,family)
        if c.config_hash in seen: continue
        seen.add(c.config_hash)
        generated.append(c.canonical_dict())
        family_counts[family]+=1
    if len(generated)!=a.candidate_count:
        raise RuntimeError(f"generation exhausted {len(generated)}/{a.candidate_count}")

    primitive=Counter()
    pre=[]
    near=[]
    with ProcessPoolExecutor(max_workers=max(1,a.workers),initializer=_init,initargs=(str(dataset),str(receipt))) as pool:
        futures=[pool.submit(_worker,c) for c in generated]
        for fut in as_completed(futures):
            r=fut.result()
            primitive["candidate_gate_pre_corr"]+=int(r["candidate_gate_pre_corr"])
            primitive["entry_ge_300"]+=int(r["trades"]>=300)
            primitive["pf_ge_1_20"]+=int(r["pf"]>=1.20)
            primitive["dd_le_25"]+=int(r["max_dd_pct"]<=25.0)
            primitive["net_ge_20k"]+=int(r["net_profit_usd"]>=20000.0)
            primitive["ev_gt_0"]+=int(r["ev_per_trade_usd"]>0.0)
            gates=sum([r["trades"]>=300,r["pf"]>=1.2,r["max_dd_pct"]<=25,r["net_profit_usd"]>=20000,r["ev_per_trade_usd"]>0])
            primitive[f"primitive_gates_{gates}"]+=1
            if gates>=4: near.append(r)
            if r["keep"]: pre.append(r)

    exact=[]
    bars={}
    for r in pre:
        row,bp,tp=impl._exact_row(d,audit,r["candidate"],"NATIVE_H4")
        row.update(impl.monte_carlo_metrics(tp,row["config_hash"]))
        conditions=[
            int(row["total_entry"])>=300,
            float(row["standard_lot_profit_factor_same_cost_model"])>=1.20,
            float(row["standard_lot_max_dd_pct_starting_equity_10000"])<=25.0,
            float(row["standard_lot_ev_per_trade_usd_same_cost_model"])>0,
            float(row["oos_profit_factor"])>=1.0,
            bool(row["monte_carlo_pass"]),
            float(row["positive_years_pct"])>=60.0,
        ]
        if all(conditions):
            exact.append(row); bars[row["config_hash"]]=bp

    exact=sorted(exact,key=impl._quality,reverse=True)
    selected=[]
    rejected=[]
    for row in exact:
        pairs=[(abs(float(pearson_log_equity(bars[row["config_hash"]],bars[o["config_hash"]]))),o["config_hash"]) for o in selected]
        corr,against=max(pairs,default=(0.0,None),key=lambda z:z[0])
        row["correlation_max"]=float(corr); row["correlation_against"]=against
        if corr<=0.50+1e-12:
            row["correlation_gate"]="PASS"; row["classification"]="HARD PASS"; row["hard_pass_gate_count"]=8; selected.append(row)
        else:
            row["correlation_gate"]="REMOVED >0.50"; row["classification"]="FAIL"; rejected.append(row)

    near=sorted(near,key=lambda r:(sum([r["trades"]>=300,r["pf"]>=1.2,r["max_dd_pct"]<=25,r["net_profit_usd"]>=20000,r["ev_per_trade_usd"]>0]),r["trades"],r["pf"],-r["max_dd_pct"]),reverse=True)[:50]
    payload={
        "schema":"gold10b-native-h4-hardpass-discovery-v1","status":"PASS",
        "dataset":{"provider":audit["crosscheck_provider"],"symbol":"COMEX:GC1!","timeframe":"H4","rows":audit["rows"],
                   "start_utc":audit["start_utc"],"end_utc":audit["end_utc"],"dataset_sha256":audit["dataset_sha256"],
                   "cost_model":"core.py COST_FLOOR_RT=0.0032","quantity_gold_units":100.0,"starting_equity_usd":10000.0,
                   "construction":"DIRECT_SOURCE_H4_BARS_NO_RESAMPLING"},
        "candidate_gate":{"entry_min":100,"net_profit_usd_min":20000.0,"corr_max":0.50},
        "hard_pass_gate":{"entry_min":300,"pf_min":1.20,"max_dd_pct_max":25.0,"ev_gt":0.0,"oos_pf_min":1.0,
                          "monte_carlo":"PASS","positive_year_pct_min":60.0,"corr_max":0.50},
        "candidate_evaluated_unique":len(generated),"generated_hashes_sha256":__import__("hashlib").sha256("\n".join(sorted(seen)).encode()).hexdigest(),
        "generated_family_counts":dict(sorted(family_counts.items())),"primitive_diagnostics":dict(sorted(primitive.items())),
        "primitive_survivors":len(pre),"full_pre_corr_hardpass":len(exact),"native_h4_hardpass_kept":len(selected),
        "native_h4_corr_rejected":len(rejected),"hard_pass_rows":selected,
        "top50_primitive_near_miss":near,
        "global_cross_timeframe_corr_status":"PENDING_IF_H4_HARDPASS_EXISTS",
        "portfolio_readiness":"NOT_READY",
        "note":"H4 HARD PASS here is native-H4-internal only until cross-timeframe global per-symbol correlation against D1 selected methods is completed.",
    }
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps({k:payload[k] for k in ["status","candidate_evaluated_unique","primitive_diagnostics","primitive_survivors","full_pre_corr_hardpass","native_h4_hardpass_kept","portfolio_readiness"]},indent=2))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
