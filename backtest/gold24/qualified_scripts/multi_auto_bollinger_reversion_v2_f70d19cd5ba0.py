from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=3,slow=13,p1=1.5,p2=30.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.0,tp=22.5,offset=0.75,expiry=7)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f3/s13 p1=1.5 p2=30.0 p3=1.0 off=0.75 exp=7","config_hash":"f70d19cd5ba0852d57068d4ff50bf14bc074d1744695485ceb93df52dd624762","trades":122,"win_rate_pct":63.114754098360656,"profit_factor":1.2422222196081696,"net_profit_usd":29033.95400000002,"ev_per_trade_usd":237.98322950819687,"max_dd_pct":50.755300396171,"sqn":1.1638913240931796,"sl_pips":2200.0,"tp_pips":2250.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
