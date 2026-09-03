from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=34,p1=1.3,p2=0.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=15.0,tp=23.5,offset=1.25,expiry=8)
EXPECTED={"method":"VOLATILITY_REGIME f5/s34 p1=1.3 p2=0.8 p3=1.0 off=1.25 exp=8","config_hash":"eabd6974b979cad0d65bb5084c4612036eb2272e703c6156f514a28e33a188a2","trades":134,"win_rate_pct":53.73134328358209,"profit_factor":1.177880485419509,"net_profit_usd":22245.39500000003,"ev_per_trade_usd":166.01041044776142,"max_dd_pct":39.625563905903185,"sqn":0.8407905824650415,"sl_pips":1500.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
