from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=13,slow=20,p1=1.5,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.0,offset=4.25,expiry=11)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f13/s20 p1=1.5 p2=40.0 p3=1.0 off=4.25 exp=11","config_hash":"c2d1ed08209c59ae4397020c13922cc83d5f9d268eb2429927b9208e95a80de4","trades":121,"win_rate_pct":62.8099173553719,"profit_factor":1.1513072287347768,"net_profit_usd":20196.43200000003,"ev_per_trade_usd":166.91266115702504,"max_dd_pct":46.20853364369603,"sqn":0.7515209831226937,"sl_pips":2450.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
