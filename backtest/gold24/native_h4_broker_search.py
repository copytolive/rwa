from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from core import FAMILIES, audit_dataset, pearson_log_equity
import multimethod_v1_discovery as impl
import native_h4_hardpass_search as base


def main() -> int:
    ap=argparse.ArgumentParser()
    ap.add_argument('--state-dir',required=True);ap.add_argument('--out',required=True)
    ap.add_argument('--candidate-count',type=int,default=20000);ap.add_argument('--workers',type=int,default=8);ap.add_argument('--seed',type=int,default=2026090411)
    a=ap.parse_args();state=Path(a.state_dir);dataset=state/'XAUUSD_MT5_NATIVE_H4_PRIMARY.csv';receipt=state/'gate_a_h4_receipt.json'
    d,audit=audit_dataset(dataset,receipt,'H4');rec=json.loads(receipt.read_text())
    construction=str(rec.get('construction') or '')
    if construction not in {'DIRECT_BROKER_NATIVE_H4_NO_RESAMPLING','DIRECT_BROKER_NATIVE_H4_DENSE_SEGMENT_NO_RESAMPLING'}:
        raise RuntimeError(f'unapproved broker H4 construction: {construction}')

    families=sorted(FAMILIES);rng=random.Random(a.seed);generated=[];seen=set();family_counts=Counter();attempts=0
    while len(generated)<a.candidate_count and attempts<a.candidate_count*50:
        attempts+=1;family=families[len(generated)%len(families)] if rng.random()<0.70 else rng.choice(families);c=base._candidate(rng,family)
        if c.config_hash in seen:continue
        seen.add(c.config_hash);generated.append(c.canonical_dict());family_counts[family]+=1
    if len(generated)!=a.candidate_count:raise RuntimeError(f'generation exhausted {len(generated)}/{a.candidate_count}')

    primitive=Counter();pre=[];near=[]
    with ProcessPoolExecutor(max_workers=max(1,a.workers),initializer=base._init,initargs=(str(dataset),str(receipt))) as pool:
        futures=[pool.submit(base._worker,c) for c in generated]
        for fut in as_completed(futures):
            r=fut.result();primitive['candidate_gate_pre_corr']+=int(r['candidate_gate_pre_corr']);primitive['entry_ge_300']+=int(r['trades']>=300)
            primitive['pf_ge_1_20']+=int(r['pf']>=1.20);primitive['dd_le_25']+=int(r['max_dd_pct']<=25.0);primitive['net_ge_20k']+=int(r['net_profit_usd']>=20000.0);primitive['ev_gt_0']+=int(r['ev_per_trade_usd']>0.0)
            gates=sum([r['trades']>=300,r['pf']>=1.2,r['max_dd_pct']<=25,r['net_profit_usd']>=20000,r['ev_per_trade_usd']>0]);primitive[f'primitive_gates_{gates}']+=1
            if gates>=4:near.append(r)
            if r['keep']:pre.append(r)

    exact=[];bars={}
    for r in pre:
        row,bp,tp=impl._exact_row(d,audit,r['candidate'],'BROKER_NATIVE_H4');row.update(impl.monte_carlo_metrics(tp,row['config_hash']))
        conditions=[int(row['total_entry'])>=300,float(row['standard_lot_profit_factor_same_cost_model'])>=1.20,float(row['standard_lot_max_dd_pct_starting_equity_10000'])<=25.0,float(row['standard_lot_ev_per_trade_usd_same_cost_model'])>0,float(row['oos_profit_factor'])>=1.0,bool(row['monte_carlo_pass']),float(row['positive_years_pct'])>=60.0]
        if all(conditions):exact.append(row);bars[row['config_hash']]=bp

    exact=sorted(exact,key=impl._quality,reverse=True);selected=[];rejected=[]
    for row in exact:
        pairs=[(abs(float(pearson_log_equity(bars[row['config_hash']],bars[o['config_hash']]))),o['config_hash']) for o in selected];corr,against=max(pairs,default=(0.0,None),key=lambda z:z[0])
        row['correlation_max']=float(corr);row['correlation_against']=against
        if corr<=0.50+1e-12:row['correlation_gate']='PASS';row['classification']='HARD PASS';row['hard_pass_gate_count']=8;selected.append(row)
        else:row['correlation_gate']='REMOVED >0.50';row['classification']='FAIL';rejected.append(row)

    near=sorted(near,key=lambda r:(sum([r['trades']>=300,r['pf']>=1.2,r['max_dd_pct']<=25,r['net_profit_usd']>=20000,r['ev_per_trade_usd']>0]),r['trades'],r['pf'],-r['max_dd_pct']),reverse=True)[:50]
    payload={
        'schema':'gold10b-broker-native-h4-hardpass-discovery-v2-dense','status':'PASS',
        'dataset':{'provider':rec.get('primary_provider'),'broker_server':rec.get('primary_broker_server'),'symbol':rec.get('primary_symbol'),'logical_symbol':'GOLD','timeframe':'H4','rows':audit['rows'],'start_utc':audit['start_utc'],'end_utc':audit['end_utc'],'dataset_sha256':audit['dataset_sha256'],'cost_model':'core.py COST_FLOOR_RT=0.0032','quantity_gold_units':100.0,'starting_equity_usd':10000.0,'construction':construction,'crosscheck_provider':audit['crosscheck_provider'],'cadence_audit':rec.get('cadence_audit')},
        'candidate_gate':{'entry_min':100,'net_profit_usd_min':20000.0,'corr_max':0.50},
        'hard_pass_gate':{'entry_min':300,'pf_min':1.20,'max_dd_pct_max':25.0,'ev_gt':0.0,'oos_pf_min':1.0,'monte_carlo':'PASS','positive_year_pct_min':60.0,'corr_max':0.50},
        'candidate_evaluated_unique':len(generated),'generated_family_counts':dict(sorted(family_counts.items())),'primitive_diagnostics':dict(sorted(primitive.items())),'primitive_survivors':len(pre),'full_pre_corr_hardpass':len(exact),'native_h4_hardpass_kept':len(selected),'native_h4_corr_rejected':len(rejected),'hard_pass_rows':selected,'top50_primitive_near_miss':near,'global_cross_timeframe_corr_status':'PENDING_IF_H4_HARDPASS_EXISTS','portfolio_readiness':'NOT_READY','note':'Direct broker-server dense H4 segment only; sparse pre-H4 history was dropped, never resampled. Global logical-GOLD correlation against D1 remains mandatory.'}
    Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(payload,indent=2)+'\n')
    print(json.dumps({k:payload[k] for k in ['status','candidate_evaluated_unique','primitive_diagnostics','primitive_survivors','full_pre_corr_hardpass','native_h4_hardpass_kept']},indent=2));return 0

if __name__=='__main__':raise SystemExit(main())
