from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=34,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=15.0,tp=22.5,offset=4.75,expiry=6)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s34 p1=1.0 p2=55.0 p3=1.0 off=4.75 exp=6","config_hash":"af9e89cdbb3036c2e5e7732cf1c8a71dbc9fcee3ef4559bcac310441f82d4b6a","trades":118,"win_rate_pct":59.32203389830509,"profit_factor":1.3096836520631574,"net_profit_usd":29964.376999999986,"ev_per_trade_usd":253.93539830508462,"max_dd_pct":30.43040497551256,"sqn":1.4515323926341612,"sl_pips":1500.0,"tp_pips":2250.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
