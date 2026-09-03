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
    def hard_gate_score_no_corr(x):
        checks=(
            int(x["total_entry"])>=300,
            float(x["profit_factor_net"])>=1.20,
            float(x["max_dd_pct"])<=25.0,
            float(x["ev_per_trade_usd"])>0.0,
            float(x["oos_profit_factor"])>=1.00,
            bool(x["monte_carlo_pass"]),
            float(x["positive_years_pct"])>=60.0,
        )
        return sum(bool(v) for v in checks)

    def quality(r):
        x=by[r["method"]]
        return (
            -hard_gate_score_no_corr(x),
            -int(int(x["total_entry"])>=300),
            -int(float(x["max_dd_pct"])<=25.0),
            -float(x["profit_factor_net"]),
            -float(x["net_profit_usd"]),
            float(x["max_dd_pct"]),
            -int(x["total_entry"]),
        )

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

    # Exact HARD PASS / WATCH / FAIL classification after global correlation.
    hard_pass_count=0
    watch_count=0
    fail_count=0
    for r in rec:
        x=by[r["method"]]
        corr_ok=(r.get("global_corr_gate")=="PASS")
        gates={
            "entry_ge_300":int(x["total_entry"])>=300,
            "pf_ge_1_20":float(x["profit_factor_net"])>=1.20,
            "max_dd_le_25":float(x["max_dd_pct"])<=25.0,
            "ev_gt_0":float(x["ev_per_trade_usd"])>0.0,
            "oos_pf_ge_1":float(x["oos_profit_factor"])>=1.00,
            "monte_carlo_pass":bool(x["monte_carlo_pass"]),
            "positive_year_ge_60":float(x["positive_years_pct"])>=60.0,
            "corr_le_0_50":bool(corr_ok),
        }
        gate_count=sum(bool(v) for v in gates.values())
        candidate_pass=(
            int(x["total_entry"])>=100
            and float(x["net_profit_usd"])>=20000.0
            and corr_ok
        )
        if gate_count==8:
            cls="HARD PASS"; hard_pass_count+=1
        elif candidate_pass and gate_count>=5:
            cls="WATCH"; watch_count+=1
        else:
            cls="FAIL"; fail_count+=1
        r["hard_pass_gates"]=gates
        r["hard_pass_gate_count"]=gate_count
        r["classification"]=cls

    # Build the largest quality-ordered diversified subset with max family share <=25%.
    # We search target sizes from 10 down to the mandatory minimum 6. This avoids a
    # transient greedy dead-end such as 2/7 >25% even when another feasible subset exists.
    diversified=[]
    diversified_target=0
    for target in range(min(10,len(kept)),5,-1):
        cap=max(1,int(math.floor(0.25*target+1e-12)))
        trial=[]
        counts={}
        for r in ordered:
            if r not in kept:
                continue
            fam=r["family"]
            if counts.get(fam,0)>=cap:
                continue
            trial.append(r)
            counts[fam]=counts.get(fam,0)+1
            if len(trial)==target:
                break
        if len(trial)!=target:
            continue
        distinct=len(set(x["family"] for x in trial))
        share=max(counts.values())/target if target else 0.0
        if distinct>=6 and share<=0.25+1e-12:
            diversified=trial
            diversified_target=target
            break

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

    diversified_n=len(diversified)
    diversified_family_counts={f:sum(r["family"]==f for r in diversified) for f in sorted(set(r["family"] for r in diversified))}
    diversified_max_family_share=(max(diversified_family_counts.values())/diversified_n) if diversified_n else 0.0
    diversified_budgeted=portfolio_metrics(diversified,1.0/max(diversified_n,1))
    diversified_full=portfolio_metrics(diversified,1.0)

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
      "hard_pass_count":hard_pass_count,
      "watch_count":watch_count,
      "fail_count":fail_count,
      "hard_pass_definition":"8/8 = Entry>=300, PF>=1.20, MaxDD<=25%, EV>0, OOS PF>=1.00, Monte Carlo PASS, Positive Year>=60%, global Corr<=0.50",
      "diversified_subset_count":diversified_n,
      "diversified_subset_target":diversified_target,
      "diversified_subset_methods":[x["method"] for x in diversified],
      "diversified_family_counts":diversified_family_counts,
      "diversified_distinct_family_count":len(diversified_family_counts),
      "diversified_max_family_share":float(diversified_max_family_share),
      "diversified_minimum_gate":bool(diversified_n>=6 and len(diversified_family_counts)>=6 and diversified_max_family_share<=0.25+1e-12),
      "diversified_target10_gate":bool(diversified_n>=10 and len(diversified_family_counts)>=10),
      "diversified_full_size_stack":diversified_full,
      "diversified_equal_budget_total_1x":diversified_budgeted,
      "portfolio_readiness":"NOT_READY" if (hard_pass_count==0 or not (diversified_n>=10 and len(diversified_family_counts)>=10)) else "RESEARCH_READY_NOT_LIVE_READY",
      "full_size_stack_all_input":full_all,
      "equal_budget_total_1x_all_input":budgeted_all,
      "full_size_stack_final":full_final,
      "equal_budget_total_1x_final":budgeted_final,
      "note":"Final Corr Max/Gate is post-greedy and refers only to the surviving global selected set. The diversified subset additionally enforces >=6 distinct families and <=25% family concentration where feasible. Portfolio PnL/DD are canonical bar-PnL diagnostics only; broker margin, spread/slippage, swap, netting/hedging and execution interaction are not validated, so this is not live-ready."
    }
    Path(a.out).write_text(json.dumps(payload,indent=2)+"\n")
    print(json.dumps(payload,indent=2))
if __name__=="__main__": main()
