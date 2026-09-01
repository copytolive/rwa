from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=20,slow=144,p1=52.0,p2=62.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=24.0,tp=24.0,offset=2.0,expiry=5)
EXPECTED={"method":"CANDLE_ENGULFING f20/s144 p1=52.0 p2=62.0 p3=1.0 off=2.0 exp=5","config_hash":"da946a87a6319b754c9f42b97a34e5954ca5a731e56e3964c762a9c9cc9ec1d1","trades":151,"win_rate_pct":66.2251655629139,"profit_factor":1.3110480078387923,"net_profit_usd":46006.648000000016,"ev_per_trade_usd":304.6797880794703,"max_dd_pct":30.93636968101326,"sqn":1.6181203308382128,"sl_pips":2400.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
