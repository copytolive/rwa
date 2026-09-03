from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=13,slow=20,p1=1.3,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=24.0,offset=3.75,expiry=12)
EXPECTED={"method":"ROLLING_ZSCORE f13/s20 p1=1.3 p2=55.0 p3=1.0 off=3.75 exp=12","config_hash":"02d0dc10d1f5b7a2f1798f1ef77d1f9052578f986b99d5c67162ab221c2d49e5","trades":198,"win_rate_pct":62.121212121212125,"profit_factor":1.127560561785159,"net_profit_usd":28341.06349999991,"ev_per_trade_usd":143.1366843434339,"max_dd_pct":61.92819525385632,"sqn":0.8008042353161761,"sl_pips":2400.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
