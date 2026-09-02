from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=55,slow=100,p1=55.0,p2=58.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=23.0,tp=23.5,offset=3.25,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f55/s100 p1=55.0 p2=58.0 p3=1.0 off=3.25 exp=8","config_hash":"b27c57af4988aa89b12d9421250f8244c1460fb9f1570590c8501579a869a45b","trades":202,"win_rate_pct":61.881188118811885,"profit_factor":1.140478507811444,"net_profit_usd":29978.889500000012,"ev_per_trade_usd":148.410344059406,"max_dd_pct":91.68590775490574,"sqn":0.8904794236912116,"sl_pips":2300.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
