from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=20,slow=21,p1=1.4,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=1.5,expiry=1)
EXPECTED={"method":"VOLUME f20/s21 p1=1.4 p2=55.0 p3=1.0 off=1.5 exp=1","config_hash":"6a1be0199547f346397eb2b8645e339e4ff4a5a58628a10ae4e7c4c9c1403dc4","trades":104,"win_rate_pct":68.26923076923077,"profit_factor":1.4180044997844758,"net_profit_usd":41255.67600000002,"ev_per_trade_usd":396.6891923076925,"max_dd_pct":27.192505783869336,"sqn":1.7257436959989703,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
