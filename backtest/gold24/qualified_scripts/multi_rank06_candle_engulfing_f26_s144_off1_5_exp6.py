from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=55.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=18.0,tp=23.0,offset=1.5,expiry=6)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=52.0 p3=1.0 off=1.5 exp=6","config_hash":"4aea51fc5e449e7d3fafcdbc72d2c9fc88bfeff76db580f57e9a83cc0dc89c4d","trades":163,"win_rate_pct":57.668711656441715,"profit_factor":1.1262287252832743,"net_profit_usd":19726.030000000017,"ev_per_trade_usd":121.01858895705531,"max_dd_pct":61.51019024830882,"sqn":0.7436978344630172,"sl_pips":1800.0,"tp_pips":2300.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
