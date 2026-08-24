from __future__ import annotations
import csv, hashlib, json
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT=Path('mt5-ci/generated'); OUT.mkdir(parents=True,exist_ok=True)
csv_path=OUT/'smoke_ticks.csv'
# Keep >100 M1 bars of warm-up history before the requested tester start.
# MT5's Strategy Tester needs pre-roll history; without it, the tester can shift
# the effective start beyond the available tick tape and produce 0 ticks.
start=datetime(2024,1,1,22,0,0,tzinfo=timezone.utc)
end=datetime(2024,1,2,2,0,0,tzinfo=timezone.utc)
spread=0.00010
buy_anchor=datetime(2024,1,2,0,10,0,tzinfo=timezone.utc)
sell_anchor=datetime(2024,1,2,1,10,0,tzinfo=timezone.utc)

def lerp(a,b,x): return a+(b-a)*x

def pulse_bid(t, anchor, direction):
    s=(t-anchor).total_seconds(); base=1.10000
    if direction > 0:
        if 0<=s<=20: return lerp(base,1.10020,s/20)
        if 20<s<=50: return lerp(1.10020,1.10070,(s-20)/30)
        if 50<s<=90: return lerp(1.10070,base,(s-50)/40)
    else:
        if 0<=s<=20: return lerp(base,1.09980,s/20)
        if 20<s<=50: return lerp(1.09980,1.09930,(s-20)/30)
        if 50<s<=90: return lerp(1.09930,base,(s-50)/40)
    return None

def bid_at(t):
    v=pulse_bid(t,buy_anchor,1)
    if v is not None: return v
    v=pulse_bid(t,sell_anchor,-1)
    if v is not None: return v
    return 1.10000

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
(OUT/'dataset_meta.json').write_text(json.dumps({'sha256':sha,'symbol':'CT_EURUSD','from':start.isoformat(),'to':end.isoformat(),'spread':spread,'warmup_minutes':120},indent=2),encoding='utf-8')
print(sha)
