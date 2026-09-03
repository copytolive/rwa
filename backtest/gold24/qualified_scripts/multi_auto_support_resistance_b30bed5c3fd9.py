from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=34,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=20.5,tp=25.0,offset=1.5,expiry=9)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s34 p1=1.0 p2=55.0 p3=1.0 off=1.5 exp=9","config_hash":"b30bed5c3fd92d94396a42b0b4b7820ab5dfb4680fc9f8e9ae7d71f50740d0e2","trades":126,"win_rate_pct":63.492063492063494,"profit_factor":1.4155628039543087,"net_profit_usd":49139.22900000001,"ev_per_trade_usd":389.993880952381,"max_dd_pct":23.6776374975804,"sqn":1.9319873418021218,"sl_pips":2050.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
