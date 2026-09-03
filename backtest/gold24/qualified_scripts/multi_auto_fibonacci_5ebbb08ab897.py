from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIBONACCI',fast=7,slow=8,p1=0.618,p2=5.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=25.0,offset=2.5,expiry=6)
EXPECTED={"method":"FIBONACCI f7/s8 p1=0.618 p2=5.0 p3=1.0 off=2.5 exp=6","config_hash":"5ebbb08ab8973788fa26cfb1982d6c86950955da19976f5da76f6d6a5c685a47","trades":105,"win_rate_pct":60.95238095238095,"profit_factor":1.2102406951627225,"net_profit_usd":23966.30499999997,"ev_per_trade_usd":228.25052380952354,"max_dd_pct":32.18485774660766,"sqn":0.9544711027281285,"sl_pips":2250.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
