from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='TREND_EMA',fast=55,slow=144,p1=66.0,p2=52.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=25.0,offset=5.0,expiry=9)
EXPECTED={"method":"TREND_EMA f55/s144 p1=66.0 p2=52.0 p3=1.0 off=5.0 exp=9","config_hash":"8d5841e06d54fc4d702e00d0b8b5e407d2ed2ab351fd56470968fd6bb526ffa2","trades":108,"win_rate_pct":63.888888888888886,"profit_factor":1.2360586857835372,"net_profit_usd":27814.176000000058,"ev_per_trade_usd":257.5386666666672,"max_dd_pct":35.40745960815306,"sqn":1.0330658102832362,"sl_pips":2350.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
