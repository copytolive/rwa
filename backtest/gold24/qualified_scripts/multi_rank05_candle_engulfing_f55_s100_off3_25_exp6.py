from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=55,slow=100,p1=66.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=25.0,tp=25.0,offset=3.25,expiry=6)
EXPECTED={"method":"CANDLE_ENGULFING f55/s100 p1=66.0 p2=52.0 p3=1.0 off=3.25 exp=6","config_hash":"497d743f3d97045c0efc44b6a8a3301665b67bedba4f857bf46dd086229d1014","trades":146,"win_rate_pct":62.32876712328767,"profit_factor":1.1261634935064526,"net_profit_usd":20739.365000000013,"ev_per_trade_usd":142.05044520547955,"max_dd_pct":61.39524382719287,"sqn":0.6973747945107034,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
