from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=26,p1=1.3,p2=0.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=25.0,offset=1.25,expiry=9)
EXPECTED={"method":"VOLATILITY_REGIME f5/s26 p1=1.3 p2=0.8 p3=1.0 off=1.25 exp=9","config_hash":"bac04b6b28283d3c1d980b65580431739df4515d8342379cff46dd806b8bb32e","trades":116,"win_rate_pct":66.37931034482759,"profit_factor":1.44429080735015,"net_profit_usd":50869.03999999999,"ev_per_trade_usd":438.5262068965517,"max_dd_pct":23.288027419926717,"sqn":1.7791524605295537,"sl_pips":2350.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
