from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=5,slow=89,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=25.0,tp=24.0,offset=3.25,expiry=7)
EXPECTED={"method":"ROLLING_ZSCORE f5/s89 p1=2.1 p2=55.0 p3=1.0 off=3.25 exp=7","config_hash":"f402d96a0ff0d844baced008f516c6ae75c28d25299626889373b8fa59086506","trades":134,"win_rate_pct":67.16417910447761,"profit_factor":1.2942142234266913,"net_profit_usd":39910.70899999999,"ev_per_trade_usd":297.8411119402984,"max_dd_pct":41.06347100050455,"sqn":1.4439592697229957,"sl_pips":2500.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
