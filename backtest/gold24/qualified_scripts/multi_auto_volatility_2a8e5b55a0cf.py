from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY',fast=50,slow=55,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=1.0,expiry=8)
EXPECTED={"method":"VOLATILITY f50/s55 p1=1.0 p2=55.0 p3=1.0 off=1.0 exp=8","config_hash":"2a8e5b55a0cf9f37587bc685cd6bfc57adc381b0ff00c09424425e37b37c62d6","trades":108,"win_rate_pct":62.96296296296296,"profit_factor":1.163977051219853,"net_profit_usd":20892.830000000016,"ev_per_trade_usd":193.45212962962978,"max_dd_pct":52.79116733528161,"sqn":0.7028054878048978,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
