from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY',fast=3,slow=8,p1=1.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=1.5,expiry=11)
EXPECTED={"method":"VOLATILITY f3/s8 p1=1.2 p2=55.0 p3=1.0 off=1.5 exp=11","config_hash":"30089110db75e701c01f4af7b023f107750fa74259b28347c0abee273102f94d","trades":140,"win_rate_pct":65.71428571428571,"profit_factor":1.2447105959167717,"net_profit_usd":35500.94800000008,"ev_per_trade_usd":253.57820000000055,"max_dd_pct":41.29117899796043,"sqn":1.2529869156564346,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
