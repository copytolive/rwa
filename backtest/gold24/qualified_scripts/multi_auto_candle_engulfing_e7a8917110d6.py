from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CANDLE_ENGULFING',fast=26,slow=144,p1=55.0,p2=66.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.0,tp=23.0,offset=1.75,expiry=6)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=66.0 p3=1.0 off=1.75 exp=6","config_hash":"e7a8917110d62b9beebe338d269ebfc29057cbec1f3a451b15ec485c8ab1a0aa","trades":160,"win_rate_pct":60.0,"profit_factor":1.181578025378315,"net_profit_usd":27665.08450000001,"ev_per_trade_usd":172.90677812500007,"max_dd_pct":50.51595917673496,"sqn":1.032338458821066,"sl_pips":1900.0,"tp_pips":2300.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
