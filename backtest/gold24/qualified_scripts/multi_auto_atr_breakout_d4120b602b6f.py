from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ATR_BREAKOUT',fast=3,slow=13,p1=2.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=4.5,expiry=7)
EXPECTED={"method":"ATR_BREAKOUT f3/s13 p1=2.2 p2=55.0 p3=1.0 off=4.5 exp=7","config_hash":"d4120b602b6f750a311b71fc9fd70c59df9c3428fe0df061d43b2584ab728bc1","trades":108,"win_rate_pct":64.81481481481481,"profit_factor":1.1686139569027831,"net_profit_usd":20207.078000000074,"ev_per_trade_usd":187.10257407407477,"max_dd_pct":48.70354015532582,"sqn":0.7767117154875803,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
