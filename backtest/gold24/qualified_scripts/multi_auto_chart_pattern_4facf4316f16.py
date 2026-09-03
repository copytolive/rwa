from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=3,slow=26,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=17.5,tp=19.0,offset=3.25,expiry=8)
EXPECTED={"method":"CHART_PATTERN f3/s26 p1=0.7 p2=55.0 p3=1.0 off=3.25 exp=8","config_hash":"4facf4316f1659f1d0fd3f728dac1e44f06b5c4c0409dcef3156a434a0539cee","trades":143,"win_rate_pct":64.33566433566433,"profit_factor":1.1800282902051202,"net_profit_usd":20867.60299999999,"ev_per_trade_usd":145.92729370629363,"max_dd_pct":36.210257810959995,"sqn":0.9527235566214542,"sl_pips":1750.0,"tp_pips":1900.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
