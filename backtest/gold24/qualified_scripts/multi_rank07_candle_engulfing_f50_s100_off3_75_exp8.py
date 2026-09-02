from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=50,slow=100,p1=55.0,p2=66.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=23.0,tp=24.0,offset=3.75,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f50/s100 p1=55.0 p2=66.0 p3=1.0 off=3.75 exp=8","config_hash":"68c3985dfe3bea091f2af4c84dbae5bcc67439a5f04199dd17170020b71dba54","trades":199,"win_rate_pct":60.80402010050251,"profit_factor":1.1176752709345308,"net_profit_usd":25489.780000000006,"ev_per_trade_usd":128.08934673366838,"max_dd_pct":89.90145104689582,"sqn":0.7499630650556262,"sl_pips":2300.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
