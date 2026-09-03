from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=20,p1=2.0,p2=35.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=25.0,offset=1.25,expiry=6)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s20 p1=2.0 p2=35.0 p3=1.0 off=1.25 exp=6","config_hash":"b108c7b47aad301100275000958a90f913dfa159c35b59aaa5208735e0803860","trades":102,"win_rate_pct":60.78431372549019,"profit_factor":1.1718877648825377,"net_profit_usd":20553.249500000034,"ev_per_trade_usd":201.50244607843172,"max_dd_pct":54.57818552402952,"sqn":0.7522418851944926,"sl_pips":2450.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
