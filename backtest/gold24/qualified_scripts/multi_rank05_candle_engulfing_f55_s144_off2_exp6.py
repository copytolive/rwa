from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=55,slow=144,p1=58.0,p2=62.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=18.0,tp=24.5,offset=2.0,expiry=6)
EXPECTED={"method":"CANDLE_ENGULFING f55/s144 p1=58.0 p2=62.0 p3=1.0 off=2.0 exp=6","config_hash":"e02f67ebcfefeb1fef8ec5a73e7a0f25c3a4878cd597b9a2a23ea8e12899e2a6","trades":162,"win_rate_pct":56.79012345679013,"profit_factor":1.1658130988591193,"net_profit_usd":26401.46100000001,"ev_per_trade_usd":162.97198148148155,"max_dd_pct":53.29969278554697,"sqn":0.9631716538444153,"sl_pips":1800.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
