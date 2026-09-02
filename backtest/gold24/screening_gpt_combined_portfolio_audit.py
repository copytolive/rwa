from __future__ import annotations
import argparse, importlib.util, json, math, sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
Q=HERE/"qualified_scripts"
for p in (str(HERE),str(Q)):
    if p not in sys.path: sys.path.insert(0,p)
from core import audit_dataset,backtest_candidate,pearson_log_equity,compute_metrics
import qualified_scripts.validate_qualified_scripts as vqs

def load(stem):
    p=Q/f"{stem}.py"
    spec=importlib.util.spec_from_file_location("m_"+stem,p)
    m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--state-dir",required=True); ap.add_argument("--out",required=True); a=ap.parse_args()
    state=Path(a.state_dir)
    d,audit=audit_dataset(state/"gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv",state/"gate_a/gate_a_receipt.json","D1")
    stems=vqs.STRICT+vqs.MULTI
    rec=[]
    bars={}
    for stem in stems:
        m=load(stem); c=m.CANDIDATE
        r=backtest_candidate(d,c,flat_lot=100.0)
        bars[stem]=np.asarray(r["bar_pnl"],float)
        rec.append({"stem":stem,"method":m.EXPECTED["method"],"family":c.family,"config_hash":c.config_hash})
    n=len(rec)
    mat=np.eye(n)
    pairs=[]
    for i in range(n):
        for j in range(i+1,n):
            c=abs(float(pearson_log_equity(bars[rec[i]["stem"]],bars[rec[j]["stem"]])))
            mat[i,j]=mat[j,i]=c
            pairs.append({"i":i+1,"j":j+1,"a":rec[i]["method"],"b":rec[j]["method"],"corr_abs":c})
    pairs.sort(key=lambda x:x["corr_abs"],reverse=True)
    for i,r in enumerate(rec):
        r["raw_global_corr_max"]=max([mat[i,j] for j in range(n) if j!=i],default=0.0)
        r["raw_global_corr_gate"]="PASS" if r["raw_global_corr_max"]<=0.5+1e-12 else "FAIL"

    # Global greedy quality order across STRICT + MULTI together.
    auditj=json.loads((HERE/"runtime_screening_gpt"/"screening_gpt_real_audit.json").read_text())
    by={x["method"]:x for x in auditj["rows"]}
    def quality(r):
        x=by[r["method"]]
        return (-float(x["profit_factor_net"]),-float(x["net_profit_usd"]),float(x["max_dd_pct"]),-int(x["total_entry"]))

    ordered=sorted(rec,key=quality)
    kept=[]
    rejected=[]
    for r in ordered:
        conflicts=[]
        for k in kept:
            i=rec.index(r); j=rec.index(k); corr=mat[i,j]
            if corr>0.5+1e-12:
                conflicts.append((k,corr))
        if conflicts:
            rejected.append({
                "method":r["method"],
                "stem":r["stem"],
                "family":r["family"],
                "reason":"corr>0.50",
                "conflicts":[{"method":k["method"],"corr_abs":corr} for k,corr in conflicts],
            })
            r["global_selection"]="REJECTED"
        else:
            kept.append(r)
            r["global_selection"]="KEPT"

    # Final Corr Max is recomputed only against methods that survive greedy selection.
    kept_idx=[rec.index(x) for x in kept]
    for r in rec:
        i=rec.index(r)
        if r in kept:
            peers=[j for j in kept_idx if j!=i]
            final_corr=max([mat[i,j] for j in peers],default=0.0)
            r["global_corr_max"]=float(final_corr)
            r["global_corr_gate"]="PASS" if final_corr<=0.5+1e-12 else "FAIL"
        else:
            r["global_corr_max"]=None
            r["global_corr_gate"]="REMOVED"

    def portfolio_metrics(methods, scale):
        bp=sum((bars[x["stem"]] for x in methods), np.zeros(len(d),dtype=float))*scale
        eq=10000.0+np.cumsum(bp)
        peak=np.maximum.accumulate(eq)
        dd=np.where(peak>0,(peak-eq)/peak*100,0)
        return {
            "methods":len(methods),
            "scale_per_strategy":scale,
            "net_profit_usd":float(bp.sum()),
            "max_dd_pct":float(dd.max(initial=0)),
            "ending_equity_usd":float(eq[-1]),
            "min_equity_usd":float(eq.min()),
        }

    full_all=portfolio_metrics(rec,1.0)
    budgeted_all=portfolio_metrics(rec,1.0/n)
    k=len(kept)
    full_final=portfolio_metrics(kept,1.0)
    budgeted_final=portfolio_metrics(kept,1.0/max(k,1))
    final_family_counts={f:sum(r["family"]==f for r in kept) for f in sorted(set(r["family"] for r in kept))}
    final_max_family_share=(max(final_family_counts.values())/k) if k else 0.0

    payload={
      "status":"PASS",
      "methods_input":n,
      "methods_final":k,
      "dataset_rows":int(audit["rows"]),
      "global_pair_count":len(pairs),
      "pairs_gt_0_50":sum(p["corr_abs"]>0.5 for p in pairs),
      "max_pair":pairs[0],
      "top10_pairs":pairs[:10],
      "rows":rec,
      "global_greedy_kept_count":k,
      "global_greedy_kept":[x["method"] for x in kept],
      "global_greedy_rejected":rejected,
      "family_counts_input":{f:sum(r["family"]==f for r in rec) for f in sorted(set(r["family"] for r in rec))},
      "family_counts_final":final_family_counts,
      "final_distinct_family_count":len(final_family_counts),
      "final_max_family_share":float(final_max_family_share),
      "portfolio_ready_diversification":bool(len(final_family_counts)>=6 and final_max_family_share<=0.25+1e-12),
      "full_size_stack_all_input":full_all,
      "equal_budget_total_1x_all_input":budgeted_all,
      "full_size_stack_final":full_final,
      "equal_budget_total_1x_final":budgeted_final,
      "note":"Final Corr Max/Gate is post-greedy and therefore refers only to the surviving global selected set. Portfolio PnL remains a canonical bar-PnL diagnostic and does not model broker margin/slippage/netting interactions."
    }
    Path(a.out).write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps(payload,indent=2))
if __name__=="__main__": main()
