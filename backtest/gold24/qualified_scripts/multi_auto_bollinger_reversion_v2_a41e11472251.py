from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=7,slow=14,p1=1.5,p2=35.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=1.75,expiry=2)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f7/s14 p1=1.5 p2=35.0 p3=1.0 off=1.75 exp=2","config_hash":"a41e11472251bd47cc6349edd949afd30aded3deeb2b46818bae5ce508cc49cf","trades":134,"win_rate_pct":62.6865671641791,"profit_factor":1.1738730803158948,"net_profit_usd":25742.749,"ev_per_trade_usd":192.1100671641791,"max_dd_pct":45.81351303711651,"sqn":0.9038388516322906,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
