from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=50,slow=100,p1=55.0,p2=66.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=22.0,tp=22.0,offset=4.25,expiry=7)
EXPECTED={"method":"CANDLE_ENGULFING f50/s100 p1=55.0 p2=66.0 p3=1.0 off=4.25 exp=7","config_hash":"0c55ca7195b636d6661364f37d9601c5c2e6241e6b569d19eea5e564509850fe","trades":197,"win_rate_pct":62.43654822335025,"profit_factor":1.117020696065601,"net_profit_usd":23115.786000000007,"ev_per_trade_usd":117.33901522842643,"max_dd_pct":97.28060590730732,"sqn":0.7329329084686459,"sl_pips":2200.0,"tp_pips":2200.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
