from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=21,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=18.0,tp=19.5,offset=3.0,expiry=12)
EXPECTED={"method":"CHART_PATTERN f5/s21 p1=0.7 p2=55.0 p3=1.0 off=3.0 exp=12","config_hash":"fa16e61b3d3207ef135a61a394ce0e7e1f6ab82855c128876f06339363f3273f","trades":120,"win_rate_pct":65.0,"profit_factor":1.2122705543167942,"net_profit_usd":20521.915999999987,"ev_per_trade_usd":171.01596666666654,"max_dd_pct":34.193271800861844,"sqn":1.018461267838629,"sl_pips":1800.0,"tp_pips":1950.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
