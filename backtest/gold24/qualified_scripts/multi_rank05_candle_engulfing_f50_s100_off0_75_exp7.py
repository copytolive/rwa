from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=50,slow=100,p1=66.0,p2=66.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=25.0,tp=25.0,offset=0.75,expiry=7)
EXPECTED={"method":"CANDLE_ENGULFING f50/s100 p1=66.0 p2=66.0 p3=1.0 off=0.75 exp=7","config_hash":"4533ce2d7391292be0942cde4628db6f4a126dcbab5a7a5186166c91d2837fef","trades":150,"win_rate_pct":63.333333333333336,"profit_factor":1.1735851123900645,"net_profit_usd":28854.612500000017,"ev_per_trade_usd":192.36408333333344,"max_dd_pct":55.02705039569261,"sqn":0.9523924097727005,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
