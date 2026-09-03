from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=10,p1=1.1,p2=0.6,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=22.5,offset=4.5,expiry=2)
EXPECTED={"method":"VOLATILITY_REGIME f5/s10 p1=1.1 p2=0.6 p3=1.0 off=4.5 exp=2","config_hash":"36faeee60dcc0a98f2215629f59d4620ce52285ca2b4d926cda478cfa10e81c5","trades":139,"win_rate_pct":64.74820143884892,"profit_factor":1.2095864435289687,"net_profit_usd":29125.208000000086,"ev_per_trade_usd":209.53387050359774,"max_dd_pct":36.2860740644279,"sqn":0.9915226896998198,"sl_pips":2250.0,"tp_pips":2250.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
