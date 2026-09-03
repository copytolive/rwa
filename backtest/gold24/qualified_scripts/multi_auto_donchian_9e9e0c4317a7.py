from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=3,slow=100,p1=55.0,p2=58.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=25.0,tp=25.0,offset=2.5,expiry=8)
EXPECTED={"method":"DONCHIAN f3/s100 p1=55.0 p2=58.0 p3=1.0 off=2.5 exp=8","config_hash":"9e9e0c4317a723ea457f7747128f737625422aaf88d40463f31b5cbfbb8bc990","trades":121,"win_rate_pct":66.94214876033058,"profit_factor":1.3266462996411097,"net_profit_usd":40425.16199999999,"ev_per_trade_usd":334.0922479338842,"max_dd_pct":32.047430942960325,"sqn":1.5061745097902628,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
