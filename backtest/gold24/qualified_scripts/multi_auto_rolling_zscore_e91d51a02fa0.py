from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=13,slow=89,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=20.0,tp=24.5,offset=1.0,expiry=6)
EXPECTED={"method":"ROLLING_ZSCORE f13/s89 p1=2.1 p2=55.0 p3=1.0 off=1.0 exp=6","config_hash":"e91d51a02fa0fbe48dbf3b4a70d27e2d6907a79574171740f28e3b7b2114e6c2","trades":138,"win_rate_pct":60.869565217391305,"profit_factor":1.2135065751598153,"net_profit_usd":29451.40399999999,"ev_per_trade_usd":213.4159710144927,"max_dd_pct":41.19427450269118,"sqn":1.1176764223632394,"sl_pips":2000.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
