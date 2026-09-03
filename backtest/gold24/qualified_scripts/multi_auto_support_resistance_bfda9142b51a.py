from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=26,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=20.0,tp=21.5,offset=1.75,expiry=11)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s26 p1=1.0 p2=55.0 p3=1.0 off=1.75 exp=11","config_hash":"bfda9142b51a0b890f97b3ba56d1944bb79cec49e2177ad7e54ce110edd1304b","trades":162,"win_rate_pct":64.81481481481481,"profit_factor":1.2840021556577141,"net_profit_usd":40514.41300000001,"ev_per_trade_usd":250.08896913580253,"max_dd_pct":29.15771392687177,"sqn":1.551978452659322,"sl_pips":2000.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
