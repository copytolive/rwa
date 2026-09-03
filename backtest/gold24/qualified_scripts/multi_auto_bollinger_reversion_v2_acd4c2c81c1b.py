from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=3,slow=14,p1=1.5,p2=30.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=16.0,tp=25.0,offset=2.5,expiry=11)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f3/s14 p1=1.5 p2=30.0 p3=1.0 off=2.5 exp=11","config_hash":"acd4c2c81c1b1e9a6ea2edba3c9bc0893ecc756035efb01df0a7caf5381af8d9","trades":103,"win_rate_pct":56.310679611650485,"profit_factor":1.37304755490004,"net_profit_usd":34131.75400000003,"ev_per_trade_usd":331.37625242718474,"max_dd_pct":34.556921899132846,"sqn":1.5988411131346085,"sl_pips":1600.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
