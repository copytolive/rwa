from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=58.0,p2=58.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=25.0,tp=25.0,offset=2.75,expiry=7)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=58.0 p2=58.0 p3=1.0 off=2.75 exp=7","config_hash":"4b9f29a975f601fdef05a83c4ebffb861e6bc3c34e318a8e879b7e17940131f1","trades":145,"win_rate_pct":64.13793103448276,"profit_factor":1.2148916789477933,"net_profit_usd":33505.86900000002,"ev_per_trade_usd":231.07495862068978,"max_dd_pct":45.12773427678914,"sqn":1.13946588972763,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
