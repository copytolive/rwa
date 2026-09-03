from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIBONACCI',fast=3,slow=5,p1=0.618,p2=5.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=25.0,offset=1.25,expiry=12)
EXPECTED={"method":"FIBONACCI f3/s5 p1=0.618 p2=5.0 p3=1.0 off=1.25 exp=12","config_hash":"7dd97cce11f10cbb2f45d991e906b9cc814af8e274840c9955f7e2357ebcd601","trades":128,"win_rate_pct":60.15625,"profit_factor":1.1424245061077485,"net_profit_usd":21012.860999999917,"ev_per_trade_usd":164.16297656249935,"max_dd_pct":54.92793552390112,"sqn":0.7160305420643384,"sl_pips":2350.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
