from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=21,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.5,tp=8.0,offset=2.25,expiry=8)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s21 p1=0.7 p2=55.0 p3=1.0 off=2.25 exp=8","config_hash":"f0781115f863165fffd6bb966835546a8b4938f63aaf68ef38e0d0a63fedc7c2","trades":141,"win_rate_pct":87.94326241134752,"profit_factor":1.5142836938270536,"net_profit_usd":21679.372999999923,"ev_per_trade_usd":153.75441843971578,"max_dd_pct":17.93482269334624,"sqn":1.5701695030034288,"sl_pips":2150.0,"tp_pips":800.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
