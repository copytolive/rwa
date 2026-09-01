from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="DONCHIAN",fast=3,slow=89,p1=66.0,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=24.0,tp=25.0,offset=4.75,expiry=3)
EXPECTED={"method":"DONCHIAN f3/s89 p1=66.0 p2=55.0 p3=1.0 off=4.75 exp=3","config_hash":"7970caa4ee8c38c0003ccb504ee9f55138c8da747f9021fa71fae9210f088525","trades":114,"win_rate_pct":67.54385964912281,"profit_factor":1.4228990572716056,"net_profit_usd":45520.547500000044,"ev_per_trade_usd":399.30304824561443,"max_dd_pct":55.26599999999999,"sqn":1.8325564329960953,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
