#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, itertools, json, math, os, time, urllib.request
from collections import deque
from pathlib import Path
RAW="https://raw.githubusercontent.com/zcbmlijygrdwa/fx_EUR_USD_tick/master";ENGINE_VERSION="VF-1.0.0";OUT=Path("backtest/results");OUT.mkdir(parents=True,exist_ok=True)
def months_between(a,b):
 y,m=map(int,a.split("-"));ey,em=map(int,b.split("-"));out=[]
 while (y,m)<=(ey,em):
  out.append(f"{y:04d}-{m:02d}");m+=1
  if m==13:y,m=y+1,1
  if len(out)>240:raise ValueError("range too large")
 return out
def prices_for_month(ym):
 req=urllib.request.Request(f"{RAW}/EURUSD-{ym}_converted.txt",headers={"User-Agent":"VectorForge/1.0"})
 with urllib.request.urlopen(req,timeout=120) as r:
  for raw in r:
   try:
    p=float(raw.decode("utf-8","ignore").strip().replace(","," ").replace(";"," ").split()[0])
    if .2<p<5:yield p
   except (ValueError,IndexError):continue
class Roll:
 def __init__(self,n):self.n=n;self.q=deque();self.s=0.;self.ss=0.
 def add(self,x):
  self.q.append(x);self.s+=x;self.ss+=x*x
  if len(self.q)>self.n:y=self.q.popleft();self.s-=y;self.ss-=y*y
 def ready(self):return len(self.q)==self.n
 def mean(self):return self.s/len(self.q)
 def sd(self):
  m=self.mean();return math.sqrt(max(0.,self.ss/len(self.q)-m*m))
class Sim:
 def __init__(self,c):
  self.c=c;self.bal=c["initial_balance"];self.peak=self.bal;self.dd=self.ddpct=0.;self.pos=None;self.n=self.w=self.l=0;self.gw=self.gl=self.pips=0.;self.samples=0;self.last=None;self.r1=Roll(c["p1"]);self.r2=Roll(c["p2"]);self.e1=self.e2=None;self.rg=self.rl=0.;self.rseed=0
 def signal(self,p):
  c=self.c;s=0
  if c["strategy"]=="sma_cross":
   self.r1.add(p);self.r2.add(p)
   if self.r1.ready() and self.r2.ready():s=1 if self.r1.mean()>self.r2.mean() else -1
  elif c["strategy"]=="ema_cross":
   a1=2/(c["p1"]+1);a2=2/(c["p2"]+1);self.e1=p if self.e1 is None else a1*p+(1-a1)*self.e1;self.e2=p if self.e2 is None else a2*p+(1-a2)*self.e2
   if self.samples>=c["p2"]:s=1 if self.e1>self.e2 else -1
  elif c["strategy"]=="rsi_mr" and self.last is not None:
   d=p-self.last;g=max(0.,d);l=max(0.,-d);n=c["p1"]
   if self.rseed<n:
    self.rg+=g;self.rl+=l;self.rseed+=1
    if self.rseed==n:self.rg/=n;self.rl/=n
   else:self.rg=(self.rg*(n-1)+g)/n;self.rl=(self.rl*(n-1)+l)/n
   if self.rseed>=n:
    rsi=100 if self.rl==0 else 100-100/(1+self.rg/self.rl);lo=max(1,min(49,c["p2"]));hi=100-lo
    if rsi<=lo:s=1
    elif rsi>=hi:s=-1
  elif c["strategy"]=="bollinger_mr":
   self.r1.add(p)
   if self.r1.ready():
    m=self.r1.mean();sd=self.r1.sd();dev=max(.1,c["p2"]/10)
    if p<m-dev*sd:s=1
    elif p>m+dev*sd:s=-1
  elif c["strategy"]=="breakout":
   if self.r1.ready():
    hi=max(self.r1.q);lo=min(self.r1.q)
    if p>hi:s=1
    elif p<lo:s=-1
   self.r1.add(p)
  self.last=p;return s
 def open(self,side,bid):
  c=self.c;pip=.0001;spr=c["spread"]*pip;slip=c["slippage"]*pip;entry=bid+spr+slip if side>0 else bid-slip;d=c["sl"]*pip;self.pos={"side":side,"entry":entry,"stop":entry-d if side>0 else entry+d,"tp":entry+d*c["rr"] if side>0 else entry-d*c["rr"]}
 def close(self,bid):
  c=self.c;p=self.pos;pip=.0001;spr=c["spread"]*pip;slip=c["slippage"]*pip;exit=bid-slip if p["side"]>0 else bid+spr+slip;pp=((exit-p["entry"]) if p["side"]>0 else (p["entry"]-exit))/pip;pnl=pp*10*c["lot"]-c["commission"]*c["lot"];self.bal+=pnl;self.peak=max(self.peak,self.bal);dd=self.peak-self.bal;self.dd=max(self.dd,dd);self.ddpct=max(self.ddpct,dd/self.peak*100 if self.peak else 0);self.n+=1;self.pips+=pp
  if pnl>0:self.w+=1;self.gw+=pnl
  else:self.l+=1;self.gl+=abs(pnl)
  self.pos=None
 def tick(self,bid):
  self.samples+=1
  if self.pos:
   ask=bid+self.c["spread"]*.0001;p=self.pos
   if (p["side"]>0 and (bid<=p["stop"] or bid>=p["tp"])) or (p["side"]<0 and (ask>=p["stop"] or ask<=p["tp"])):self.close(bid)
  s=self.signal(bid)
  if s:
   if self.pos and s!=self.pos["side"]:self.close(bid)
   if not self.pos:self.open(s,bid)
 def result(self,months):
  if self.pos and self.last is not None:self.close(self.last)
  return{"trades":self.n,"wins":self.w,"losses":self.l,"win_rate":self.w/self.n*100 if self.n else 0,"profit_factor":self.gw/self.gl if self.gl else (999999 if self.gw else 0),"net_pnl":self.bal-self.c["initial_balance"],"return_pct":(self.bal/self.c["initial_balance"]-1)*100,"max_drawdown":self.dd,"max_drawdown_pct":self.ddpct,"expectancy_pips":self.pips/self.n if self.n else 0,"trades_per_month":self.n/max(1,months),"samples":self.samples}
def run_config(c,months):
 sim=Sim(c)
 for ym in months:
  print("STREAM",ym,"config",c["strategy"],c["p1"],c["p2"],flush=True)
  for p in prices_for_month(ym):sim.tick(p)
 r=sim.result(len(months));payload={"engine_version":ENGINE_VERSION,"config":c,"data":{"source":"zcbmlijygrdwa/fx_EUR_USD_tick","months":months}};h=hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(",",":")).encode()).hexdigest();return{"evaluation_hash":h,**payload,"summary":r}
def ints(spec):
 vals=[]
 for part in spec.split(","):
  part=part.strip()
  if not part:continue
  if ":" in part:
   z=list(map(int,part.split(":")));a,b=z[:2];step=z[2] if len(z)>2 else 1;vals.extend(range(a,b+1,step))
  else:vals.append(int(part))
 return sorted(set(vals))
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--start",default=os.getenv("START_MONTH","2018-01"));ap.add_argument("--end",default=os.getenv("END_MONTH","2018-01"));ap.add_argument("--strategy",default=os.getenv("STRATEGY","sma_cross"),choices=["sma_cross","ema_cross","rsi_mr","breakout","bollinger_mr"]);ap.add_argument("--p1",default=os.getenv("P1_GRID","50,100,200"));ap.add_argument("--p2",default=os.getenv("P2_GRID","500,1000,1500"));args=ap.parse_args();months=months_between(args.start,args.end);rows=[];t0=time.time()
 for p1,p2 in itertools.product(ints(args.p1),ints(args.p2)):
  if args.strategy in ("sma_cross","ema_cross") and p1>=p2:continue
  c={"strategy":args.strategy,"p1":p1,"p2":p2,"initial_balance":10000.,"lot":.1,"spread":1.,"slippage":.2,"sl":20.,"rr":2.,"commission":7.};rows.append(run_config(c,months))
 ledger={"status":"COMPLETED","engine_version":ENGINE_VERSION,"created_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"evaluations":len(rows),"unique_evaluation_hashes":len({r["evaluation_hash"] for r in rows}),"elapsed_seconds":round(time.time()-t0,3),"runs":rows};(OUT/"latest.json").write_text(json.dumps(ledger,indent=2,allow_nan=False));stamp=time.strftime("%Y%m%dT%H%M%SZ",time.gmtime());(OUT/f"run-{stamp}.json").write_text(json.dumps(ledger,indent=2,allow_nan=False));print(json.dumps({k:v for k,v in ledger.items() if k!="runs"},indent=2))
if __name__=="__main__":main()
