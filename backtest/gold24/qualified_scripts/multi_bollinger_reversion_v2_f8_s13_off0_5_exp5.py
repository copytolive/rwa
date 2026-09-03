from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="BOLLINGER_REVERSION_V2",fast=8,slow=13,p1=1.5,p2=30.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=19.0,tp=18.0,offset=0.5,expiry=5)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f8/s13 p1=1.5 p2=30.0 p3=1.0 off=0.5 exp=5","config_hash":"0b27901d1ce62559b1b7efa0c30bf8005edf5addd2b68d398b2d8b6a34eb09c6","trades":129,"win_rate_pct":65.11627906976744,"profit_factor":1.217568175138416,"net_profit_usd":23281.02400000005,"ev_per_trade_usd":180.47305426356627,"max_dd_pct":42.63220035057319,"sqn":1.0014851541268472,"sl_pips":1900,"tp_pips":1800}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
