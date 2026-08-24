#!/usr/bin/env python3
# Certification trigger 2026-08-25: no strategy-logic change.
from __future__ import annotations
import argparse, hashlib, json, urllib.request
from pathlib import Path
import numpy as np
import pandas as pd
MIRROR_COMMIT='e70301147e1d3d89ff02d781684618d30f7dab0d'
BASE_RAW=f'https://raw.githubusercontent.com/Paaktingc/forex_bot/{MIRROR_COMMIT}/data/raw'
URLS={2024:BASE_RAW+'/HISTDATA_COM_MT_XAUUSD_M12024/DAT_ASCII_XAUUSD_M1_2024.csv',2025:BASE_RAW+'/HISTDATA_COM_MT_XAUUSD_M12025/DAT_ASCII_XAUUSD_M1_2025.csv'}
FROZEN=dict(riskATR=4.0,lockTrig=0.30,lockProfit=0.25,expiry=32,maxbars=192,initialRR=2.0)
def sha256_file(path):
 h=hashlib.sha256();
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
 return h.hexdigest()
def download(url,path):
 req=urllib.request.Request(url,headers={'User-Agent':'p45-holdout-frozen/1.0'})
 with urllib.request.urlopen(req,timeout=120) as r,open(path,'wb') as w:
  while True:
   c=r.read(1024*1024)
   if not c: break
   w.write(c)
def load_histdata(paths):
 frames=[]; names=['stamp','Open','High','Low','Close','Volume']
 for p in paths:
  q=pd.read_csv(p,sep=';',header=None,names=names,dtype={'stamp':str}); q['dt']=pd.to_datetime(q['stamp'],format='%Y%m%d %H%M%S'); frames.append(q[['dt','Open','High','Low','Close']])
 m1=pd.concat(frames).drop_duplicates('dt').sort_values('dt').set_index('dt')
 return m1[['Open','High','Low','Close']].resample('15min').agg({'Open':'first','High':'max','Low':'min','Close':'last'}).dropna().reset_index()
def build(df,start,end):
 O,H,L,C=[df[x].to_numpy(float) for x in ['Open','High','Low','Close']]; sH,sL,sC=map(pd.Series,[H,L,C]); prev=sC.shift(1)
 tr=pd.concat([(sH-sL).abs(),(sH-prev).abs(),(sL-prev).abs()],axis=1).max(axis=1); atr=tr.ewm(alpha=1/14,adjust=False,min_periods=14).mean().to_numpy(); e50=sC.ewm(span=50,adjust=False,min_periods=50).mean().to_numpy(); e200=sC.ewm(span=200,adjust=False,min_periods=200).mean().to_numpy()
 up=(e50>e200)&(C>e200); dn=(e50<e200)&(C<e200); dt=df.dt; wkkey=dt.dt.to_period('W-SUN').astype(str); tmp=pd.DataFrame({'week':wkkey,'H':H,'L':L}); wk=tmp.groupby('week').agg(H=('H','max'),L=('L','min')).shift(1); prevH=pd.Series(wkkey).map(wk.H).to_numpy(); prevL=pd.Series(wkkey).map(wk.L).to_numpy(); side=np.where(up&(C>prevH),1,np.where(dn&(C<prevL),-1,0)).astype(np.int8); price=np.where(side==1,prevH,prevL); side=np.where(((dt>=start)&(dt<end)).to_numpy(),side,0).astype(np.int8); return O,H,L,C,atr,side,price
def sim(O,H,L,C,atr,side,price,spread):
 rows=[]; i=0; last=-1; m=len(side)
 while i<m-1:
  if i<=last or side[i]==0 or not np.isfinite(price[i]) or not np.isfinite(atr[i]) or atr[i]<=0: i+=1; continue
  sd=int(side[i]); op=float(price[i]); fill=-1; entry=0.; pend_end=min(m,i+1+FROZEN['expiry'])
  for j in range(i+1,pend_end):
   if sd==1:
    ao=O[j]+spread
    if L[j]+spread<=op: entry=ao if ao<op else op; fill=j; break
   else:
    bo=O[j]
    if H[j]>=op: entry=bo if bo>op else op; fill=j; break
  if fill<0: last=pend_end-1; i=last+1; continue
  risk=float(atr[i]*FROZEN['riskATR']); sl=entry-sd*risk; tp=entry+sd*2*risk; lk=False; done=False; rv=0.; ex=fill; tpflag=0; end=min(m,fill+FROZEN['maxbars'])
  for j in range(fill,end):
   if sd==1:
    if L[j]<=sl: rv=(sl-entry)/risk; ex=j; done=True; break
    if H[j]>=tp: rv=2.; ex=j; tpflag=1; done=True; break
    if (not lk) and H[j]>=entry+FROZEN['lockTrig']*risk: sl=entry+FROZEN['lockProfit']*risk; lk=True
   else:
    if H[j]+spread>=sl: rv=(entry-sl)/risk; ex=j; done=True; break
    if L[j]+spread<=tp: rv=2.; ex=j; tpflag=1; done=True; break
    if (not lk) and L[j]+spread<=entry-FROZEN['lockTrig']*risk: sl=entry-FROZEN['lockProfit']*risk; lk=True
  if not done: ex=end-1; px=C[ex] if sd==1 else C[ex]+spread; rv=sd*(px-entry)/risk
  rows.append((i,fill,ex,sd,entry,risk,rv,tpflag,1 if lk else 0)); last=ex; i=ex+1
 return np.array(rows,float) if rows else np.empty((0,9),float)
def met(rows,start,end):
 n=len(rows); weeks=(end-start).total_seconds()/604800
 if not n:return dict(trades=0,fills_week=0,positive=0,full_tp=0,pf=0,expectancy_R=0,net_R=0,max_dd_R=0)
 r=rows[:,6]; tp=rows[:,7]; gp=r[r>0].sum(); gl=-r[r<0].sum(); eq=np.r_[0,np.cumsum(r)]; return dict(trades=int(n),fills_week=float(n/weeks),positive=float((r>0).mean()),full_tp=float(tp.mean()),pf=float(gp/gl if gl>0 else 999),expectancy_R=float(r.mean()),net_R=float(r.sum()),max_dd_R=float((np.maximum.accumulate(eq)-eq).max()))
def gate(m,stress=False): return m['positive']>=.60 and m['fills_week']>=2 and m['trades']>=104 and m['pf']>=(1.00 if stress else 1.05) and m['expectancy_R']>0
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--output',default='p45_holdout_2025_result.json'); a=ap.parse_args(); wd=Path('holdout_data'); wd.mkdir(exist_ok=True); fs=[]; src={'mirror_repo':'Paaktingc/forex_bot','mirror_commit':MIRROR_COMMIT,'files':{}}
 for y,u in URLS.items():
  p=wd/f'DAT_ASCII_XAUUSD_M1_{y}.csv'; download(u,p); fs.append(p); src['files'][str(y)]={'bytes':p.stat().st_size,'sha256':sha256_file(p)}
 df=load_histdata(fs); start=pd.Timestamp('2025-01-01'); end=pd.Timestamp('2026-01-01'); O,H,L,C,atr,side,price=build(df,start,end); base=met(sim(O,H,L,C,atr,side,price,.15),start,end); stress=met(sim(O,H,L,C,atr,side,price,.30),start,end); decision=gate(base) and gate(stress,True); out={'strategy':'P45 Previous-Week Breakout Retest Limit','frozen_parameters':FROZEN,'holdout':'2025','source':src,'base_spread_0_15':base,'stress_spread_0_30':stress,'holdout_pass':bool(decision),'retuning_performed':False}; Path(a.output).write_text(json.dumps(out,indent=2)); print(json.dumps(out,indent=2)); return 0 if decision else 2
if __name__=='__main__': raise SystemExit(main())
