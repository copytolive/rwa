from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BAND_HYBRID',fast=21,slow=26,p1=2.0,p2=1.5,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=24.5,offset=5.0,expiry=8)
EXPECTED={"method":"BAND_HYBRID f21/s26 p1=2.0 p2=1.5 p3=1.0 off=5.0 exp=8","config_hash":"5552d00fa27463f19cfb80fcaab93cc984dcce6527c53caae06d1c91c137e193","trades":147,"win_rate_pct":61.904761904761905,"profit_factor":1.1848935140951395,"net_profit_usd":31179.26500000002,"ev_per_trade_usd":212.10384353741512,"max_dd_pct":69.26037743266237,"sqn":0.8354884228580575,"sl_pips":2350.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
