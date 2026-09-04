from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from core import Candidate, audit_dataset, pearson_log_equity, validate_candidate
import multimethod_v1_discovery as impl
import hardpass_targeted_search as base

# v5 attacks the v4 failure mode directly: v4 produced very high sample counts
# but almost no PF/Net-Profit quality. Keep frequency-oriented signal grids while
# restoring wider exits/longer pending life. Every p1 below is outside v3/v4
# signal grids, so this run is configuration-disjoint without relaxing gates.
TARGET_FAMILIES=("SUPPORT_RESISTANCE","CHART_PATTERN","BOLLINGER_REVERSION_V2","VOLUME")
TARGET_WEIGHTS=[0.36,0.28,0.24,0.12]
P1={
 "SUPPORT_RESISTANCE":[2.50,2.75,3.10,3.40,3.75,4.25,4.75,5.50],
 "CHART_PATTERN":[2.50,2.75,3.10,3.40,3.75,4.25,4.75,5.50],
 "BOLLINGER_REVERSION_V2":[1.00,1.15,1.20,1.30,1.40,1.50,1.55],
 "VOLUME":[2.60,2.80,3.10,3.40,3.75,4.25,4.75,5.50],
}
P2={
 "SUPPORT_RESISTANCE":[55.0],"CHART_PATTERN":[55.0],
 "BOLLINGER_REVERSION_V2":[35.0,40.0,42.5,45.0,47.5,50.0],"VOLUME":[55.0],
}
FAST=[2,3,4,5,6,7,8,10,12,13,14]
SLOW=[5,6,7,8,10,12,13,14,16,18,20,21,26,34,50]
SL=[15.0,16.0,17.0,17.5,18.0,18.5,19.0,19.5,20.0,20.5,21.0,21.5,22.0,22.5,23.0,23.5,24.0,24.5,25.0]
TP=[15.0,16.0,17.0,17.5,18.0,18.5,19.0,19.5,20.0,20.5,21.0,21.5,22.0,22.5,23.0,23.5,24.0,24.5,25.0]
OFFSET=[0.25,0.50,0.75,1.0,1.25,1.50,1.75,2.0,2.25]
EXPIRY=[3,4,5,6,7,8,9,10,11,12]


def candidate(rng:random.Random)->Candidate:
    family=rng.choices(list(TARGET_FAMILIES),weights=TARGET_WEIGHTS,k=1)[0]
    fast=rng.choice(FAST)
    valid=[x for x in SLOW if x>fast]
    if not valid: fast=2; valid=[x for x in SLOW if x>fast]
    slow=rng.choice(valid)
    sl=float(rng.choice(SL))
    if rng.random()<0.88:
        choices=[x for x in TP if x>=sl]
        tp=float(rng.choice(choices or TP))
    else: tp=float(rng.choice(TP))
    c=Candidate(
        symbol="GOLD",timeframe="D1",family=family,fast=int(fast),slow=int(slow),
        p1=float(rng.choice(P1[family])),p2=float(rng.choice(P2[family])),p3=1.0,
        entry_method="LIMIT" if rng.random()<0.86 else "STOP",
        direction_mode="BOTH" if rng.random()<0.90 else "LONG_ONLY",
        sl=sl,tp=tp,offset=float(rng.choice(OFFSET)),expiry=int(rng.choice(EXPIRY)),
    )
    validate_candidate(c); return c


def primitive_count(r:dict)->int:
    return sum([
        int(r.get("trades",0))>=300,float(r.get("net_profit_usd",0))>=20000.0,
        float(r.get("pf",0))>=1.20,float(r.get("max_dd_pct",1e9))<=25.0,
        float(r.get("ev_per_trade_usd",0))>0.0,
    ])


def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument("--state-dir",required=True); ap.add_argument("--prior-json",required=True)
    ap.add_argument("--prior-targeted-json",required=True); ap.add_argument("--out",required=True)
    ap.add_argument("--candidate-count",type=int,default=100000); ap.add_argument("--workers",type=int,default=8)
    ap.add_argument("--seed",type=int,default=2026090429); a=ap.parse_args()
    state=Path(a.state_dir); dataset=state/"gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv"; receipt=state/"gate_a/gate_a_receipt.json"
    d,audit=audit_dataset(dataset,receipt,"D1")
    prior=json.loads(Path(a.prior_json).read_text()); prev=json.loads(Path(a.prior_targeted_json).read_text())
    prior_eval=set(str(x) for x in prior.get("evaluated_config_hashes",[])); prior_rank=list(prior.get("ranking",[]))
    prior_hashes={str(r.get("config_hash")) for r in prior_rank}

    rng=random.Random(a.seed); generated=[]; seen=set(); fam=Counter(); attempts=0
    while len(generated)<a.candidate_count and attempts<a.candidate_count*100:
        attempts+=1; c=candidate(rng); h=c.config_hash
        if h in prior_eval or h in prior_hashes or h in seen: continue
        seen.add(h); cd=c.canonical_dict(); generated.append(cd); fam[cd["family"]]+=1
    if len(generated)!=a.candidate_count: raise RuntimeError(f"v5 generation exhausted {len(generated)}/{a.candidate_count}")

    prelim=[]; near=[]; diag=Counter()
    with ProcessPoolExecutor(max_workers=max(1,a.workers),initializer=base._init_worker,initargs=(str(dataset),str(receipt))) as pool:
        futs=[pool.submit(base._worker,c) for c in generated]
        for fut in as_completed(futs):
            r=fut.result(); n=primitive_count(r); diag[f"gates_{n}"]+=1
            diag["entry_ge_300"]+=int(int(r["trades"])>=300); diag["net_ge_20k"]+=int(float(r["net_profit_usd"])>=20000)
            diag["pf_ge_1_20"]+=int(float(r["pf"])>=1.20); diag["dd_le_25"]+=int(float(r["max_dd_pct"])<=25); diag["ev_gt_0"]+=int(float(r["ev_per_trade_usd"])>0)
            if n>=4: near.append(r)
            if r["keep"]: prelim.append(r)
    near=sorted(near,key=lambda r:(primitive_count(r),int(r["trades"]),float(r["net_profit_usd"]),float(r["pf"]),-float(r["max_dd_pct"])),reverse=True)[:100]

    exact=[]; newbars={}
    for r in prelim:
        row,bp,tp=impl._exact_row(d,audit,r["candidate"],"HARDPASS_TARGETED_V5")
        if int(row["total_entry"])<300 or float(row["standard_lot_net_profit_usd_same_cost_model"])<20000 or float(row["standard_lot_profit_factor_same_cost_model"])<1.20: continue
        if float(row["standard_lot_max_dd_pct_starting_equity_10000"])>25 or float(row["standard_lot_ev_per_trade_usd_same_cost_model"])<=0: continue
        if float(row["oos_profit_factor"])<1.0 or float(row["positive_years_pct"])<60: continue
        row.update(impl.monte_carlo_metrics(tp,row["config_hash"]))
        if not bool(row["monte_carlo_pass"]): continue
        exact.append(row); newbars[row["config_hash"]]=bp

    current=[]; bars={}
    for old in prior_rank:
        cdict=old.get("candidate")
        if not cdict: continue
        row,bp,tp=impl._exact_row(d,audit,cdict,"PRIOR_SELECTED"); row.update(impl.monte_carlo_metrics(tp,row["config_hash"]))
        current.append(row); bars[row["config_hash"]]=bp
    for old in prev.get("new_hard_pass_rows",[]):
        cdict=old.get("candidate")
        if not cdict: continue
        row,bp,tp=impl._exact_row(d,audit,cdict,"PRIOR_TARGETED"); row.update(impl.monte_carlo_metrics(tp,row["config_hash"]))
        current.append(row); bars[row["config_hash"]]=bp
    for row in exact: current.append(row); bars[row["config_hash"]]=newbars[row["config_hash"]]

    byexec={}
    for row in sorted(current,key=impl._quality,reverse=True): byexec.setdefault(str(row.get("execution_hash_qty100") or row["config_hash"]),row)
    selected=[]; rejected=[]
    for row in sorted(byexec.values(),key=impl._quality,reverse=True):
        pairs=[(abs(float(pearson_log_equity(bars[row["config_hash"]],bars[o["config_hash"]]))),o["config_hash"]) for o in selected]
        corr,against=max(pairs,default=(0.0,None),key=lambda z:z[0]); row["correlation_max"]=float(corr); row["correlation_against"]=against
        if corr<=0.50+1e-12: row["correlation_gate"]="PASS"; base._classify(row); selected.append(row)
        else: row["correlation_gate"]="REMOVED >0.50"; base._classify(row); rejected.append(row)
    hard=[r for r in selected if r["classification"]=="HARD PASS"]; watch=[r for r in selected if r["classification"]=="WATCH"]; fail=[r for r in selected if r["classification"]=="FAIL"]
    hard_new=[r for r in hard if r.get("origin")=="HARDPASS_TARGETED_V5"]
    master=int(prior.get("evaluated_config_hash_count_cumulative",len(prior_eval)) or 0)
    payload={
      "schema":"gold10b-hardpass-targeted-search-v5-wide-exit-frequency","status":"PASS",
      "dataset":{"provider":audit.get("crosscheck_provider"),"symbol":"COMEX:GC1!","timeframe":"D1","rows":audit.get("rows"),"start_utc":audit.get("start_utc"),"end_utc":audit.get("end_utc"),"dataset_sha256":audit.get("dataset_sha256"),"quantity_gold_units":100.0,"starting_equity_usd":10000.0},
      "candidate_gate":{"entry_min":100,"net_profit_usd_min":20000.0,"corr_max":0.50},
      "hard_pass_gate":{"entry_min":300,"pf_min":1.20,"max_dd_pct_max":25.0,"ev_gt":0.0,"oos_pf_min":1.0,"monte_carlo":"PASS","positive_year_pct_min":60.0,"corr_max":0.50},
      "master_evaluated":master,"targeted_evaluated_unique":len(generated),
      "generation_profile":{"name":"wide-exit-frequency-v5","families":list(TARGET_FAMILIES),"generated_family_counts":dict(sorted(fam.items())),"disjoint_from_v3_v4":True,"disjoint_rule":"family p1 grid values do not overlap v3/v4","threshold_relaxation":False},
      "primitive_diagnostics":dict(sorted(diag.items())),"top100_primitive_near_miss":near,
      "prefilter_survivors":len(prelim),"full_pre_corr_survivors":len(exact),"selected_after_global_corr":len(selected),
      "hard_pass_count":len(hard),"hard_pass_new_count":len(hard_new),"watch_count":len(watch),"fail_count":len(fail),"global_corr_rejected":len(rejected),
      "new_hard_pass_rows":hard_new,
      "top50_after_global_corr":sorted(selected,key=lambda r:(int(r.get("hard_pass_gate_count",0)),int(r.get("total_entry",0)),float(r.get("standard_lot_profit_factor_same_cost_model",0.0)),-float(r.get("standard_lot_max_dd_pct_starting_equity_10000",1e9))),reverse=True)[:50],
    }
    Path(a.out).parent.mkdir(parents=True,exist_ok=True); Path(a.out).write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps({k:payload[k] for k in ["status","targeted_evaluated_unique","primitive_diagnostics","prefilter_survivors","full_pre_corr_survivors","hard_pass_count","hard_pass_new_count","watch_count","fail_count","global_corr_rejected"]},indent=2))
    return 0

if __name__=="__main__": raise SystemExit(main())
