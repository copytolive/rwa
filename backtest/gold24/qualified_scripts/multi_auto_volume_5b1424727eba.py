from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=5,slow=144,p1=1.4,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=24.0,tp=24.5,offset=1.5,expiry=7)
EXPECTED={"method":"VOLUME f5/s144 p1=1.4 p2=55.0 p3=1.0 off=1.5 exp=7","config_hash":"5b1424727eba7691c6234324b5928768a63b1dfe628311aa093b2542de98c2ed","trades":153,"win_rate_pct":62.745098039215684,"profit_factor":1.2260394583772063,"net_profit_usd":37643.56800000005,"ev_per_trade_usd":246.0363921568631,"max_dd_pct":40.03932641935452,"sqn":1.155542929387467,"sl_pips":2400.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
