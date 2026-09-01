from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=89,slow=144,p1=55.0,p2=66.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=22.5,tp=23.5,offset=4.5,expiry=5)
EXPECTED={"method":"CANDLE_ENGULFING f89/s144 p1=55.0 p2=66.0 p3=1.0 off=4.5 exp=5","config_hash":"55208f786ea8f781d6da7ed2444e8287ebe0eb86b3c956569c63d75414cb2626","trades":137,"win_rate_pct":64.23357664233576,"profit_factor":1.2284691593381174,"net_profit_usd":30933.901000000034,"ev_per_trade_usd":225.79489781021923,"max_dd_pct":41.47498542921399,"sqn":1.1700569710919249,"sl_pips":2250.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
