from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=55.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=16.5,tp=21.0,offset=1.75,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=52.0 p3=1.0 off=1.75 exp=8","config_hash":"db02ceb03b2a80d41e08ef0271529a78acac546b4dea2d370b8fc71dd9d75dc0","trades":226,"win_rate_pct":57.52212389380531,"profit_factor":1.1091473548130675,"net_profit_usd":22340.717499999984,"ev_per_trade_usd":98.85273230088488,"max_dd_pct":54.435821862258194,"sqn":0.7412514788404337,"sl_pips":1650.0,"tp_pips":2100.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
