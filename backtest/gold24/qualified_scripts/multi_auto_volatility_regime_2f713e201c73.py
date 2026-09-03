from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=26,p1=1.1,p2=0.6,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.0,tp=23.0,offset=2.25,expiry=4)
EXPECTED={"method":"VOLATILITY_REGIME f5/s26 p1=1.1 p2=0.6 p3=1.0 off=2.25 exp=4","config_hash":"2f713e201c73b2ff7d1b68a698ac8bec1f69e6512477c655a88c5a1e7ce889ef","trades":147,"win_rate_pct":59.863945578231295,"profit_factor":1.1369041811568297,"net_profit_usd":20552.679000000087,"ev_per_trade_usd":139.81414285714345,"max_dd_pct":45.0167092256408,"sqn":0.6985458409925448,"sl_pips":1900.0,"tp_pips":2300.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
