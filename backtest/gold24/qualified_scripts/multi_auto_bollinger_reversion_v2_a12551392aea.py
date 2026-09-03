from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=20,p1=1.5,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=16.5,tp=23.0,offset=1.25,expiry=7)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s20 p1=1.5 p2=40.0 p3=1.0 off=1.25 exp=7","config_hash":"a12551392aea7b1d0bb0f7fa2812ca2ea5d5cd99d43c223ab57834a2326ed8fc","trades":129,"win_rate_pct":61.24031007751938,"profit_factor":1.4614073581144658,"net_profit_usd":50512.81000000001,"ev_per_trade_usd":391.5721705426358,"max_dd_pct":30.184915304855203,"sqn":2.02335246676568,"sl_pips":1650.0,"tp_pips":2300.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
