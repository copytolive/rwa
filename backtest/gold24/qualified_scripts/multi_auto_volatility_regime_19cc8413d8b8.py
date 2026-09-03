from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=20,p1=1.1,p2=0.7,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=2.5,expiry=10)
EXPECTED={"method":"VOLATILITY_REGIME f5/s20 p1=1.1 p2=0.7 p3=1.0 off=2.5 exp=10","config_hash":"19cc8413d8b888e36af8d5da756596c890c0f007a11990dc9fa15b0a9b58542e","trades":149,"win_rate_pct":64.42953020134229,"profit_factor":1.2210452113695318,"net_profit_usd":36468.13800000008,"ev_per_trade_usd":244.75260402684617,"max_dd_pct":58.703354191353576,"sqn":1.1077108653115906,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
