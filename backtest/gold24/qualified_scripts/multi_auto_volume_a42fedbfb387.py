from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=13,slow=21,p1=1.4,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=2.0,expiry=4)
EXPECTED={"method":"VOLUME f13/s21 p1=1.4 p2=55.0 p3=1.0 off=2.0 exp=4","config_hash":"a42fedbfb387dcceae1cf7be5181c5bca3b7ed3377e9c94d4dbce290a8764661","trades":103,"win_rate_pct":65.04854368932038,"profit_factor":1.2070715389023503,"net_profit_usd":22352.552000000043,"ev_per_trade_usd":217.01506796116547,"max_dd_pct":42.255659581084196,"sqn":0.9204179107461328,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
