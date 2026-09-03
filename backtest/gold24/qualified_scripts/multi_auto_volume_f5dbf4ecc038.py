from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=14,slow=21,p1=1.4,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=0.5,expiry=3)
EXPECTED={"method":"VOLUME f14/s21 p1=1.4 p2=55.0 p3=1.0 off=0.5 exp=3","config_hash":"f5dbf4ecc03823ebd3f8c1214aff1af2bb9564c2c227b190b46a6cf74243be8b","trades":108,"win_rate_pct":64.81481481481481,"profit_factor":1.2086232299188457,"net_profit_usd":24328.449000000048,"ev_per_trade_usd":225.2634166666671,"max_dd_pct":42.682993228991094,"sqn":0.9510722055024924,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
