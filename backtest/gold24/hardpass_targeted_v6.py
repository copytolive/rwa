from __future__ import annotations

import argparse,json,random
from collections import Counter
from concurrent.futures import ProcessPoolExecutor,as_completed
from pathlib import Path
from core import Candidate,audit_dataset,pearson_log_equity,validate_candidate
import multimethod_v1_discovery as impl
import hardpass_targeted_search as base

# v6 follows the strongest v3 near misses (high PF/net/DD but only 100-160 entries).
# It increases signal opportunity via shorter S/R/Bollinger windows while retaining
# LONG_ONLY, wide exits, and the exact locked Candidate/HARD PASS thresholds.
FAMILIES=("SUPPORT_RESISTANCE","BOLLINGER_REVERSION_V2")
WEIGHTS=[0.68,0.32]
FAST=[2,3,4,5,6,7,8]
SLOW=[5,7,8,10,12,13,14,16,18,20,21,26,34]
P1_SR=[0.85,0.95,1.05,1.10,1.15,1.20,1.25,1.30,1.35,1.40,1.50,1.60,1.75]
P1_BB=[1.20,1.30,1.40,1.50,1.60,1.70,1.80,1.90,2.00]
P2_BB=[30.0,32.5,35.0,37.5,40.0,42.5,45.0]
SL=[18.0,18.5,19.0,19.5,20.0,20.5,21.0,21.5,22.0,22.5,23.0,23.5,24.0,24.5,25.0]
TP=[20.0,20.5,21.0,21.5,22.0,22.5,23.0,23.5,24.0,24.5,25.0]
OFF=[0.25,0.5,0.75,1.0,1.25,1.5,1.75,2.0,2.25,2.5,3.0,3.5,4.0]
EXP=[3,4,5,6,7,8,9,10,11,12]

def make(r):
    fam=r.choices(FAMILIES,weights=WEIGHTS,k=1)[0];fast=r.choice(FAST);valid=[x for x in SLOW if x>fast]
    if not valid:fast=2;valid=[x for x in SLOW if x>fast]
    slow=r.choice(valid);p1=r.choice(P1_SR if fam=="SUPPORT_RESISTANCE" else P1_BB);p2=55.0 if fam=="SUPPORT_RESISTANCE" else r.choice(P2_BB)
    sl=r.choice(SL);tp=r.choice([x for x in TP if x>=sl] or TP)
    c=Candidate("GOLD","D1",fam,fast,slow,float(p1),float(p2),1.0,"LIMIT" if r.random()<0.96 else "STOP","LONG_ONLY",float(sl),float(tp),float(r.choice(OFF)),int(r.choice(EXP)))
    validate_candidate(c);return c

def gates(r):
    return sum([int(r.get('trades',0))>=300,float(r.get('net_profit_usd',0))>=20000,float(r.get('pf',0))>=1.2,float(r.get('max_dd_pct',1e9))<=25,float(r.get('ev_per_trade_usd',0))>0])

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--state-dir',required=True);ap.add_argument('--prior-json',required=True);ap.add_argument('--prior-targeted-json',required=True);ap.add_argument('--out',required=True);ap.add_argument('--candidate-count',type=int,default=60000);ap.add_argument('--workers',type=int,default=8);ap.add_argument('--seed',type=int,default=2026090437);a=ap.parse_args()
    state=Path(a.state_dir);dataset=state/'gate_a/GC1_COMEX_TRADINGVIEW_D1_PRIMARY.csv';receipt=state/'gate_a/gate_a_receipt.json';d,audit=audit_dataset(dataset,receipt,'D1')
    prior=json.loads(Path(a.prior_json).read_text());prev=json.loads(Path(a.prior_targeted_json).read_text());prior_eval=set(map(str,prior.get('evaluated_config_hashes',[])));prior_rank=list(prior.get('ranking',[]));prior_hash={str(x.get('config_hash')) for x in prior_rank}
    r=random.Random(a.seed);generated=[];seen=set();fc=Counter();attempts=0
    while len(generated)<a.candidate_count and attempts<a.candidate_count*100:
        attempts+=1;c=make(r);h=c.config_hash
        if h in seen or h in prior_eval or h in prior_hash:continue
        seen.add(h);cd=c.canonical_dict();generated.append(cd);fc[cd['family']]+=1
    if len(generated)!=a.candidate_count:raise RuntimeError(f'generation exhausted {len(generated)}/{a.candidate_count}')
    diag=Counter();pre=[];near=[]
    with ProcessPoolExecutor(max_workers=a.workers,initializer=base._init_worker,initargs=(str(dataset),str(receipt))) as pool:
        for fut in as_completed([pool.submit(base._worker,c) for c in generated]):
            z=fut.result();g=gates(z);diag[f'gates_{g}']+=1;diag['entry_ge_300']+=int(z['trades']>=300);diag['net_ge_20k']+=int(z['net_profit_usd']>=20000);diag['pf_ge_1_20']+=int(z['pf']>=1.2);diag['dd_le_25']+=int(z['max_dd_pct']<=25);diag['ev_gt_0']+=int(z['ev_per_trade_usd']>0)
            if g>=4:near.append(z)
            if z['keep']:pre.append(z)
    near=sorted(near,key=lambda z:(gates(z),z['trades'],z['pf'],-z['max_dd_pct'],z['net_profit_usd']),reverse=True)[:100]
    exact=[];bars={}
    for z in pre:
        row,bp,tp=impl._exact_row(d,audit,z['candidate'],'HARDPASS_TARGETED_V6');row.update(impl.monte_carlo_metrics(tp,row['config_hash']))
        ok=[int(row['total_entry'])>=300,float(row['standard_lot_profit_factor_same_cost_model'])>=1.2,float(row['standard_lot_max_dd_pct_starting_equity_10000'])<=25,float(row['standard_lot_ev_per_trade_usd_same_cost_model'])>0,float(row['oos_profit_factor'])>=1,bool(row['monte_carlo_pass']),float(row['positive_years_pct'])>=60]
        if all(ok):exact.append(row);bars[row['config_hash']]=bp
    current=[]
    for old in prior_rank:
        cd=old.get('candidate')
        if not cd:continue
        row,bp,tp=impl._exact_row(d,audit,cd,'PRIOR_SELECTED');row.update(impl.monte_carlo_metrics(tp,row['config_hash']));current.append(row);bars[row['config_hash']]=bp
    for old in prev.get('new_hard_pass_rows',[]):
        cd=old.get('candidate')
        if not cd:continue
        row,bp,tp=impl._exact_row(d,audit,cd,'PRIOR_TARGETED');row.update(impl.monte_carlo_metrics(tp,row['config_hash']));current.append(row);bars[row['config_hash']]=bp
    current.extend(exact);byexec={}
    for row in sorted(current,key=impl._quality,reverse=True):byexec.setdefault(str(row.get('execution_hash_qty100') or row['config_hash']),row)
    selected=[];rejected=[]
    for row in sorted(byexec.values(),key=impl._quality,reverse=True):
        pairs=[(abs(float(pearson_log_equity(bars[row['config_hash']],bars[o['config_hash']]))),o['config_hash']) for o in selected];corr,against=max(pairs,default=(0.0,None),key=lambda q:q[0]);row['correlation_max']=float(corr);row['correlation_against']=against
        if corr<=.5+1e-12:row['correlation_gate']='PASS';base._classify(row);selected.append(row)
        else:row['correlation_gate']='REMOVED >0.50';base._classify(row);rejected.append(row)
    hard=[x for x in selected if x['classification']=='HARD PASS'];new=[x for x in hard if x.get('origin')=='HARDPASS_TARGETED_V6'];watch=[x for x in selected if x['classification']=='WATCH'];fail=[x for x in selected if x['classification']=='FAIL']
    payload={'schema':'gold10b-hardpass-targeted-v6-nearmiss-recovery','status':'PASS','dataset':{'provider':audit.get('crosscheck_provider'),'symbol':'COMEX:GC1!','timeframe':'D1','rows':audit['rows'],'start_utc':audit['start_utc'],'end_utc':audit['end_utc'],'dataset_sha256':audit['dataset_sha256'],'quantity_gold_units':100.0,'starting_equity_usd':10000.0},'candidate_gate':{'entry_min':100,'net_profit_usd_min':20000.0,'corr_max':.5},'hard_pass_gate':{'entry_min':300,'pf_min':1.2,'max_dd_pct_max':25.0,'ev_gt':0.0,'oos_pf_min':1.0,'monte_carlo':'PASS','positive_year_pct_min':60.0,'corr_max':.5},'candidate_evaluated_unique':len(generated),'generation_profile':{'name':'v3-near-miss-short-window-long-only','families':list(FAMILIES),'generated_family_counts':dict(fc),'threshold_relaxation':False,'counting_policy':'separate until cross-run config-hash disjoint proof'},'primitive_diagnostics':dict(diag),'prefilter_survivors':len(pre),'full_pre_corr_survivors':len(exact),'hard_pass_count':len(hard),'hard_pass_new_count':len(new),'watch_count':len(watch),'fail_count':len(fail),'global_corr_rejected':len(rejected),'new_hard_pass_rows':new,'top100_primitive_near_miss':near}
    Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(payload,indent=2)+'\n');print(json.dumps({k:payload[k] for k in ['status','candidate_evaluated_unique','primitive_diagnostics','prefilter_survivors','full_pre_corr_survivors','hard_pass_count','hard_pass_new_count','global_corr_rejected']},indent=2));return 0
if __name__=='__main__':raise SystemExit(main())
