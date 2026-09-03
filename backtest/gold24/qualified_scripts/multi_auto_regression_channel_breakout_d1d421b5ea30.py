from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='REGRESSION_CHANNEL_BREAKOUT',fast=13,slow=89,p1=0.02,p2=2.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.5,tp=23.5,offset=2.5,expiry=8)
EXPECTED={"method":"REGRESSION_CHANNEL_BREAKOUT f13/s89 p1=0.02 p2=2.0 p3=1.0 off=2.5 exp=8","config_hash":"d1d421b5ea30a8e63e114f1d8f08f258e5c1ad2630e74957f872eeefa776f3ed","trades":227,"win_rate_pct":59.91189427312775,"profit_factor":1.1175746198307466,"net_profit_usd":28110.872000000076,"ev_per_trade_usd":123.8364405286347,"max_dd_pct":62.22067632225002,"sqn":0.766313689376439,"sl_pips":1950.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
