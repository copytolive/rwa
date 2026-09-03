from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHANDELIER_TREND',fast=3,slow=34,p1=1.5,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=3.75,expiry=8)
EXPECTED={"method":"CHANDELIER_TREND f3/s34 p1=1.5 p2=55.0 p3=1.0 off=3.75 exp=8","config_hash":"0d96809988c4a516e3a5470a3c333fcb1c4fe63d3af5985b2513ca360d8ca216","trades":327,"win_rate_pct":60.55045871559633,"profit_factor":1.063594492358947,"net_profit_usd":25264.99499999993,"ev_per_trade_usd":77.26298165137594,"max_dd_pct":63.003418461210856,"sqn":0.4934680562449771,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
