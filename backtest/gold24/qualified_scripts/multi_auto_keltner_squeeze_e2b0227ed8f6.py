from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='KELTNER_SQUEEZE',fast=3,slow=100,p1=0.7,p2=0.5,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=20.0,tp=24.5,offset=1.5,expiry=12)
EXPECTED={"method":"KELTNER_SQUEEZE f3/s100 p1=0.7 p2=0.5 p3=1.0 off=1.5 exp=12","config_hash":"e2b0227ed8f6c2254ccf425ceef73ba28eab368389679e1705cf411fd641f00f","trades":102,"win_rate_pct":64.70588235294117,"profit_factor":1.455623667238729,"net_profit_usd":40282.740000000034,"ev_per_trade_usd":394.9288235294121,"max_dd_pct":90.06930453773356,"sqn":1.867742136042195,"sl_pips":2000.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
