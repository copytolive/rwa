from __future__ import annotations
import argparse, glob, json
from pathlib import Path
import numpy as np

from core import Candidate, audit_dataset, pearson_log_equity
import multimethod_v1_discovery as impl
import multimethod_v1_discovery_strict as strict


def load(path):
    return json.loads(Path(path).read_text())


def collect_candidates(payload, out):
    for key in ("ranking", "removed_by_correlation", "new_pre_corr_rows"):
        for row in payload.get(key, []) or []:
            c=row.get("candidate")
            if not c:
                continue
            cand=Candidate(**c)
            out[cand.config_hash]=cand.canonical_dict()


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--state-dir",required=True)
    ap.add_argument("--prior-json",required=True)
    ap.add_argument("--shard-root",required=True)
    ap.add_argument("--out-dir",required=True)
    a=ap.parse_args()
    state=Path(a.state_dir); out=Path(a.out_dir); out.mkdir(parents=True,exist_ok=True)
    prior=load(a.prior_json)
    shard_paths=sorted(glob.glob(str(Path(a.shard_root)/"**/latest_multimethod_v1_discovery.json"),recursive=True))
    if not shard_paths:
        raise SystemExit("no shard payloads found")
    shards=[load(p) for p in shard_paths]

    d,audit=audit_dataset(state/"gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv",state/"gate_a/gate_a_receipt.json","D1")
    candidates={}
    collect_candidates(prior,candidates)
    for x in shards: collect_candidates(x,candidates)

    evaluated=set(str(x) for x in prior.get("evaluated_config_hashes",[]))
    for x in shards: evaluated.update(str(h) for h in x.get("evaluated_config_hashes",[]))

    exact=[]; bars={}; tradepnls={}
    for h,c in sorted(candidates.items()):
        row,bp,tp=impl._exact_row(d,audit,c,"MILLION_GLOBAL")
        if not strict._strict_library_pre_corr(row):
            continue
        exact.append(row); bars[h]=bp; tradepnls[h]=tp

    # Cross-shard execution-profile dedupe: identical exact execution can only count once.
    by_exec={}
    for row in sorted(exact,key=impl._quality,reverse=True):
        ex=str(row.get("execution_hash_qty100") or "")
        key=ex or row["config_hash"]
        if key not in by_exec: by_exec[key]=row
    combined=list(by_exec.values())
    combined.sort(key=impl._quality,reverse=True)

    selected=[]; removed=[]
    for row in combined:
        pairs=[]
        for prior_row in selected:
            corr=abs(float(pearson_log_equity(bars[row["config_hash"]],bars[prior_row["config_hash"]])))
            pairs.append((corr,prior_row["config_hash"]))
        max_corr,against=max(pairs,default=(0.0,None),key=lambda x:x[0])
        row["correlation_max"]=float(max_corr); row["correlation_against"]=against
        if max_corr<=impl.CORR_HARD_MAX+1e-12:
            row["correlation_gate"]="PASS"; selected.append(row)
        else:
            row["correlation_gate"]="REMOVED >0.50"; removed.append(row)

    for rank,row in enumerate(selected,1):
        row.update(impl.monte_carlo_metrics(tradepnls[row["config_hash"]],row["config_hash"]))
        row["tier_v1"]=impl.tier_for(row); row["rank"]=rank
        row["status"]="PASS GOLD10B MILLION GLOBAL + CANDIDATE + CORR<=0.50"

    fam={}
    for r in selected: fam[r["family"]]=fam.get(r["family"],0)+1
    max_share=max(fam.values())/len(selected) if selected else 0.0
    hard=[]; watch=[]; fail=[]
    for r in selected:
        gates=[
            int(r["total_entry"])>=300,
            float(r["standard_lot_profit_factor_same_cost_model"])>=1.20,
            float(r["standard_lot_max_dd_pct_starting_equity_10000"])<=25.0,
            float(r["standard_lot_ev_per_trade_usd_same_cost_model"])>0.0,
            float(r["oos_profit_factor"])>=1.0,
            bool(r["monte_carlo_pass"]),
            float(r["positive_years_pct"])>=60.0,
            float(r["correlation_max"])<=0.50,
        ]
        r["hard_pass_gate_count"]=sum(gates)
        r["classification"]="HARD PASS" if all(gates) else ("WATCH" if sum(gates)>=5 else "FAIL")
        (hard if r["classification"]=="HARD PASS" else watch if r["classification"]=="WATCH" else fail).append(r)

    payload={
        "schema":"gold10b-million-global-consolidated-v1","status":"PASS",
        "source_run_id":prior.get("source_run_id"),"source_batch":prior.get("source_batch"),
        "source_candidate_cursor":prior.get("source_candidate_cursor"),"source_archive_total":prior.get("source_archive_total"),
        "shard_count":len(shards),"evaluated_config_hash_count_cumulative":len(evaluated),
        "candidate_pre_corr_count":len(combined),"removed_by_correlation_count":len(removed),
        "library_count":len(selected),"selected_distinct_family_count":len(fam),"selected_family_counts":fam,
        "max_selected_family_share":max_share,"hard_pass_count":len(hard),"watch_count":len(watch),"fail_count":len(fail),
        "sample_ge_300_count":sum(int(r["total_entry"])>=300 for r in selected),
        "max_dd_le_25_count":sum(float(r["standard_lot_max_dd_pct_starting_equity_10000"])<=25 for r in selected),
        "implemented_family_count":len(impl.IMPLEMENTED_FAMILIES),
        "correlation_rule":{"maximum":0.50,"metric":"absolute Pearson correlation of log-return equity","selection":"global greedy, hard-pass-oriented quality"},
        "ranking":selected,"removed_by_correlation":removed,"evaluated_config_hashes":sorted(evaluated),
    }
    Path(out/"latest_multimethod_v1_discovery.json").write_text(json.dumps(payload,indent=2)+"\n")
    summary={k:payload[k] for k in ("schema","status","source_run_id","source_batch","source_candidate_cursor","source_archive_total","shard_count","evaluated_config_hash_count_cumulative","candidate_pre_corr_count","removed_by_correlation_count","library_count","selected_distinct_family_count","selected_family_counts","max_selected_family_share","hard_pass_count","watch_count","fail_count","sample_ge_300_count","max_dd_le_25_count","implemented_family_count")}
    Path(out/"latest_multimethod_v1_discovery_summary.json").write_text(json.dumps(summary,indent=2)+"\n")
    impl._write_csv(out/"latest_multimethod_v1_discovery.csv",selected)
    assert len(evaluated)>=1_000_000, len(evaluated)
    assert all(int(r["total_entry"])>=100 and float(r["standard_lot_net_profit_usd_same_cost_model"])>=20000 and float(r["correlation_max"])<=0.50+1e-12 for r in selected)
    print(json.dumps(summary,indent=2))

if __name__=="__main__": main()
