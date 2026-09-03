from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CANDLE_ENGULFING',fast=21,slow=144,p1=52.0,p2=52.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=18.0,tp=19.0,offset=4.25,expiry=12)
EXPECTED={"method":"CANDLE_ENGULFING f21/s144 p1=52.0 p2=52.0 p3=1.0 off=4.25 exp=12","config_hash":"6664823c8e0c326741a3e1171f186faa9b1fcb285a343a0b7bb4ceac71b2969f","trades":151,"win_rate_pct":64.90066225165563,"profit_factor":1.1747742033361792,"net_profit_usd":21262.877000000044,"ev_per_trade_usd":140.8137549668877,"max_dd_pct":36.301827776341774,"sqn":0.9492863525988092,"sl_pips":1800.0,"tp_pips":1900.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
