from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=3,slow=89,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=15.0,tp=21.5,offset=2.5,expiry=12)
EXPECTED={"method":"ROLLING_ZSCORE f3/s89 p1=2.1 p2=55.0 p3=1.0 off=2.5 exp=12","config_hash":"e453d878e0676b0147edccd06a03f560320421713d67cb32093f6402f911c889","trades":105,"win_rate_pct":60.0,"profit_factor":1.2385661214488848,"net_profit_usd":20722.517,"ev_per_trade_usd":197.35730476190477,"max_dd_pct":48.58390642435136,"sqn":1.0759639390068942,"sl_pips":1500.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
