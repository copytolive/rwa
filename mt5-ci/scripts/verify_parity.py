from __future__ import annotations
import csv,json,sys
from collections import defaultdict
from pathlib import Path

exp=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))['trades']
rows=[]
with Path(sys.argv[2]).open(newline='',encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        if r['entry'] in ('IN','OUT'):
            rows.append({'position_id':int(r['position_id']),'entry':r['entry'],'type':r['type'],'time_msc':int(r['time_msc']),'price':float(r['price']),'profit':float(r['profit'])})
pos=defaultdict(list)
for r in rows: pos[r['position_id']].append(r)
actual=[]
for ds in pos.values():
    ins=sorted([d for d in ds if d['entry']=='IN'],key=lambda x:x['time_msc']); outs=sorted([d for d in ds if d['entry']=='OUT'],key=lambda x:x['time_msc'])
    if not ins or not outs: continue
    i,o=ins[0],outs[-1]
    actual.append({'side':'BUY' if i['type']=='BUY' else 'SELL','entry_time_msc':i['time_msc'],'entry_price':i['price'],'exit_time_msc':o['time_msc'],'exit_price':o['price'],'profit':o['profit']})
actual.sort(key=lambda x:x['entry_time_msc'])
checks=[]; tol=0.000011
for n in range(max(len(exp),len(actual))):
    if n>=len(exp) or n>=len(actual): checks.append({'index':n,'pass':False,'reason':'count'}); continue
    e,a=exp[n],actual[n]
    fields={'side':a['side']==e['side'],'entry_time':a['entry_time_msc']==e['entry_time_msc'],'entry_price':abs(a['entry_price']-e['entry_price'])<=tol,'exit_time':a['exit_time_msc']==e['exit_time_msc'],'exit_price':abs(a['exit_price']-e['exit_price'])<=tol,'positive':a['profit']>0}
    checks.append({'index':n,'pass':all(fields.values()),'fields':fields,'expected':e,'actual':a})
passed=sum(c['pass'] for c in checks); den=max(len(exp),len(actual),1); parity=100*passed/den
result={'status':'PASS_NATIVE_PARITY' if parity==100 and len(exp)==len(actual) else 'FAIL_NATIVE_PARITY','parity_pct':parity,'expected_trade_count':len(exp),'actual_trade_count':len(actual),'checks':checks}
out=Path(sys.argv[3]); out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,indent=2),encoding='utf-8'); print(json.dumps(result,indent=2))
if result['status']!='PASS_NATIVE_PARITY': raise SystemExit(2)
