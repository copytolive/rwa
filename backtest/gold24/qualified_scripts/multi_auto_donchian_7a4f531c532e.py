from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=14,slow=89,p1=66.0,p2=66.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=22.0,tp=23.0,offset=1.5,expiry=4)
EXPECTED={"method":"DONCHIAN f14/s89 p1=66.0 p2=66.0 p3=1.0 off=1.5 exp=4","config_hash":"7a4f531c532ec4fd3dba6be278cb8f840b1df7ebf92ca84ac85e2bb2b16f51ae","trades":202,"win_rate_pct":62.87128712871287,"profit_factor":1.1574401827839713,"net_profit_usd":33253.180000000066,"ev_per_trade_usd":164.61970297029737,"max_dd_pct":42.656607636764626,"sqn":0.9484462708338837,"sl_pips":2200.0,"tp_pips":2300.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
