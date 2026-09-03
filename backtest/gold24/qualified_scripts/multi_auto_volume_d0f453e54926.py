from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=34,slow=89,p1=1.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=25.0,offset=1.5,expiry=4)
EXPECTED={"method":"VOLUME f34/s89 p1=1.1 p2=55.0 p3=1.0 off=1.5 exp=4","config_hash":"d0f453e54926d569040d3ae8160215e2d4680e09234a2f6bc588c4362d79d58f","trades":151,"win_rate_pct":61.58940397350993,"profit_factor":1.1873800765326163,"net_profit_usd":30903.55700000004,"ev_per_trade_usd":204.65931788079496,"max_dd_pct":44.55615084649517,"sqn":0.9631488475750646,"sl_pips":2250.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
