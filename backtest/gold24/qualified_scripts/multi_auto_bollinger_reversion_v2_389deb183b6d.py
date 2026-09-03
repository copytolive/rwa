from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=21,p1=2.0,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.0,tp=21.5,offset=2.25,expiry=8)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s21 p1=2.0 p2=40.0 p3=1.0 off=2.25 exp=8","config_hash":"389deb183b6da164f6be3b08b5cc87f5d2659602832e0db32bf318ee3ee2275b","trades":100,"win_rate_pct":64.0,"profit_factor":1.3386025865201614,"net_profit_usd":29857.564000000046,"ev_per_trade_usd":298.5756400000005,"max_dd_pct":31.24157157492914,"sqn":1.4244960068704098,"sl_pips":1900.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
