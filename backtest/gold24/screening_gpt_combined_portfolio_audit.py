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
        r["global_corr_max"]=max([mat[i,j] for j in range(n) if j!=i],default=0.0)
        r["global_corr_gate"]="PASS" if r["global_corr_max"]<=0.5+1e-12 else "FAIL"
    # global greedy quality order based on current GPT rank from verified audit
    auditj=json.loads((HERE/"runtime_screening_gpt"/"screening_gpt_real_audit.json").read_text())
    by={x["method"]:x for x in auditj["rows"]}
    def quality(r):
        x=by[r["method"]]
        # higher PF, higher NP, lower DD, more entries
        return (-float(x["profit_factor_net"]),-float(x["net_profit_usd"]),float(x["max_dd_pct"]),-int(x["total_entry"]))
    ordered=sorted(rec,key=quality)
    kept=[]
    rejected=[]
    for r in ordered:
        bad=[]
        for k in kept:
            i=rec.index(r); j=rec.index(k); c=mat[i,j]
            if c>0.5+1e-12: bad.append((k,c))
        if bad:
            rejected.append({"method":r["method"],"reason":"corr>0.50","conflicts":[{"method":k["method"],"corr_abs":c} for k,c in bad]})
        else: kept.append(r)
    # two combined scenarios
    def portfolio_metrics(scale):
        bp=sum(bars.values())*scale
        # pseudo-ledger as non-zero daily portfolio pnl for portfolio-level DD/PF-like diagnostics is misleading;
        # compute only equity DD/net/annual return from bar portfolio.
        eq=10000.0+np.cumsum(bp); peak=np.maximum.accumulate(eq); dd=np.where(peak>0,(peak-eq)/peak*100,0)
        return {"scale_per_strategy":scale,"net_profit_usd":float(bp.sum()),"max_dd_pct":float(dd.max(initial=0)),"ending_equity_usd":float(eq[-1]),"min_equity_usd":float(eq.min())}
    full=portfolio_metrics(1.0)
    budgeted=portfolio_metrics(1.0/n)
    payload={
      "status":"PASS","methods":n,"dataset_rows":int(audit["rows"]),
      "global_pair_count":len(pairs),"pairs_gt_0_50":sum(p["corr_abs"]>0.5 for p in pairs),
      "max_pair":pairs[0],"top10_pairs":pairs[:10],
      "rows":rec,"global_greedy_kept_count":len(kept),"global_greedy_kept":[x["method"] for x in kept],
      "global_greedy_rejected":rejected,
      "family_counts":{f:sum(r["family"]==f for r in rec) for f in sorted(set(r["family"] for r in rec))},
      "full_size_stack":full,"equal_budget_total_1x":budgeted,
      "note":"Portfolio PnL scenarios are diagnostic sums of canonical bar PnL; they do not model cross-strategy margin netting or broker execution interactions."
    }
    Path(a.out).write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps(payload,indent=2))
if __name__=="__main__": main()
