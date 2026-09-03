from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CHART_PATTERN",fast=5,slow=20,p1=0.7,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=23.0,tp=24.5,offset=3.0,expiry=4)
EXPECTED={"method":"CHART_PATTERN f5/s20 p1=0.7 p2=55.0 p3=1.0 off=3.0 exp=4","config_hash":"9331592e94eaa3bf1186c511e39d9e834cc3c8d371c6084a0adf79adde392e6a","trades":110,"win_rate_pct":63.63636363636363,"profit_factor":1.229077569873815,"net_profit_usd":25795.079999999994,"ev_per_trade_usd":234.50072727272723,"max_dd_pct":33.6934478832002,"sqn":1.054741098087401,"sl_pips":2300,"tp_pips":2450}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
