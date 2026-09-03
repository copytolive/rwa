from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY',fast=3,slow=8,p1=1.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=2.25,expiry=12)
EXPECTED={"method":"VOLATILITY f3/s8 p1=1.2 p2=55.0 p3=1.0 off=2.25 exp=12","config_hash":"d7adc8e5c379957dcea77624ed18e934334f83c393dc52583d3b20a9d74b4648","trades":133,"win_rate_pct":65.41353383458646,"profit_factor":1.25146311868253,"net_profit_usd":35614.292000000045,"ev_per_trade_usd":267.77663157894773,"max_dd_pct":47.553290737923284,"sqn":1.2477890452195766,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
