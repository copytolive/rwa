from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CANDLE_ENGULFING',fast=26,slow=144,p1=58.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=19.5,tp=21.5,offset=4.5,expiry=10)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=58.0 p2=55.0 p3=1.0 off=4.5 exp=10","config_hash":"878a03780c0226d224c4678294cd5ed0bebcb7c5983842c15c0ace6b7c64130b","trades":198,"win_rate_pct":63.13131313131313,"profit_factor":1.2323902025150235,"net_profit_usd":41361.43500000001,"ev_per_trade_usd":208.89613636363643,"max_dd_pct":43.24751152540957,"sqn":1.3902703919772539,"sl_pips":1950.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
