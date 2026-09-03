from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='REGRESSION_CHANNEL_BREAKOUT',fast=20,slow=21,p1=0.05,p2=2.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=24.5,offset=1.25,expiry=6)
EXPECTED={"method":"REGRESSION_CHANNEL_BREAKOUT f20/s21 p1=0.05 p2=2.0 p3=1.0 off=1.25 exp=6","config_hash":"31304b8ad08015e1bbf3a84f12228b02811b8eb9d5eda9f72a88c21d5f8ee3b4","trades":188,"win_rate_pct":62.234042553191486,"profit_factor":1.1058824824423514,"net_profit_usd":22590.30250000006,"ev_per_trade_usd":120.16118351063862,"max_dd_pct":58.86725226864586,"sqn":0.6326947160133055,"sl_pips":2350.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
