from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=55.0,p2=66.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=20.5,tp=20.5,offset=2.0,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=66.0 p3=1.0 off=2.0 exp=8","config_hash":"8dbd1e4d7bec3dfa380e99e73de4e9d0b149b449016ba193972c3a6b92b36701","trades":160,"win_rate_pct":66.875,"profit_factor":1.2777147216964904,"net_profit_usd":37435.143000000025,"ev_per_trade_usd":233.96964375000016,"max_dd_pct":37.19856690482178,"sqn":1.491012957564251,"sl_pips":2050.0,"tp_pips":2050.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
