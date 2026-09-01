from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=55.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=21.0,tp=23.5,offset=1.5,expiry=7)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=52.0 p3=1.0 off=1.5 exp=7","config_hash":"f6ad687ae3a4d69df50d2ebb647bb7e2cf506eaa0ed4209b582f8cc8b4e1cc20","trades":158,"win_rate_pct":63.29113924050633,"profit_factor":1.2829798837958624,"net_profit_usd":42416.054000000004,"ev_per_trade_usd":268.45603797468357,"max_dd_pct":40.41318737852291,"sqn":1.5303410287105523,"sl_pips":2100.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
