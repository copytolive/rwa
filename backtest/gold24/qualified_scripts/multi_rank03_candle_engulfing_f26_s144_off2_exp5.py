from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=55.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=20.5,tp=23.5,offset=2.0,expiry=5)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=52.0 p3=1.0 off=2.0 exp=5","config_hash":"f2b4a66e680b1bc73f7e7f22c6583368ee0a982fdc0bb958baf7dc45575bc41f","trades":153,"win_rate_pct":63.39869281045752,"profit_factor":1.2857269277351726,"net_profit_usd":40750.26100000001,"ev_per_trade_usd":266.3415751633988,"max_dd_pct":35.48072932399513,"sqn":1.522985865418124,"sl_pips":2050.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
