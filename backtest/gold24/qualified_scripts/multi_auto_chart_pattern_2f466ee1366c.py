from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=3,slow=34,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=22.5,offset=2.5,expiry=6)
EXPECTED={"method":"CHART_PATTERN f3/s34 p1=0.7 p2=55.0 p3=1.0 off=2.5 exp=6","config_hash":"2f466ee1366cebd77429df24e2938c693b4e28b6cf2848e120ee9b43a3f478e8","trades":102,"win_rate_pct":66.66666666666667,"profit_factor":1.335498751479758,"net_profit_usd":31857.757,"ev_per_trade_usd":312.3309509803922,"max_dd_pct":37.7393563149005,"sqn":1.4099159564874693,"sl_pips":2250.0,"tp_pips":2250.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
