from __future__ import annotations
import csv, hashlib, json
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT=Path('mt5-ci/generated'); OUT.mkdir(parents=True,exist_ok=True)
csv_path=OUT/'smoke_ticks.csv'
start=datetime(2024,1,2,0,0,0,tzinfo=timezone.utc); end=datetime(2024,1,2,2,0,0,tzinfo=timezone.utc)
spread=0.00010

def lerp(a,b,x): return a+(b-a)*x

def bid_at(t):
    s=(t-start).total_seconds(); base=1.10000
    if 600<=s<=620: return lerp(base,1.10020,(s-600)/20)
    if 620<s<=650: return lerp(1.10020,1.10070,(s-620)/30)
    if 650<s<=690: return lerp(1.10070,base,(s-650)/40)
    if 4200<=s<=4220: return lerp(base,1.09980,(s-4200)/20)
    if 4220<s<=4250: return lerp(1.09980,1.09930,(s-4220)/30)
    if 4250<s<=4290: return lerp(1.09930,base,(s-4250)/40)
    return base

with csv_path.open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['time_msc','bid','ask'])
    t=start
    while t<=end:
        bid=round(bid_at(t),5); ask=round(bid+spread,5)
        w.writerow([int(t.timestamp()*1000),f'{bid:.5f}',f'{ask:.5f}']); t+=timedelta(seconds=1)

expected={'symbol':'CT_EURUSD','trades':[
 {'side':'BUY','entry_time_msc':int(datetime(2024,1,2,0,10,20,tzinfo=timezone.utc).timestamp()*1000),'entry_price':1.10030,'exit_time_msc':int(datetime(2024,1,2,0,10,50,tzinfo=timezone.utc).timestamp()*1000),'exit_price':1.10070,'outcome':'TP','rr':2.0},
 {'side':'SELL','entry_time_msc':int(datetime(2024,1,2,1,10,20,tzinfo=timezone.utc).timestamp()*1000),'entry_price':1.09980,'exit_time_msc':int(datetime(2024,1,2,1,10,50,tzinfo=timezone.utc).timestamp()*1000),'exit_price':1.09940,'outcome':'TP','rr':2.0}]}
(OUT/'expected_ledger.json').write_text(json.dumps(expected,indent=2),encoding='utf-8')
sha=hashlib.sha256(csv_path.read_bytes()).hexdigest()
(OUT/'dataset_meta.json').write_text(json.dumps({'sha256':sha,'symbol':'CT_EURUSD','from':start.isoformat(),'to':end.isoformat(),'spread':spread},indent=2),encoding='utf-8')
print(sha)
