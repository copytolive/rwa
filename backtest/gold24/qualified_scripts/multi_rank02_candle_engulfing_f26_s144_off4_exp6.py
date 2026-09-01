from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=26,slow=144,p1=58.0,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=22.0,tp=24.5,offset=4.0,expiry=6)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=58.0 p2=55.0 p3=1.0 off=4.0 exp=6","config_hash":"8e67545d3333f4f8fee880e17643a997782d3960c6218d0736898e2c283c8bf5","trades":139,"win_rate_pct":64.02877697841727,"profit_factor":1.312503519311633,"net_profit_usd":42167.36800000002,"ev_per_trade_usd":303.36235971223033,"max_dd_pct":36.43746717274477,"sqn":1.56883628698416,"sl_pips":2200.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
