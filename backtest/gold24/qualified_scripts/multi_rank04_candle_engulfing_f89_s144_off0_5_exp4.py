from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=89,slow=144,p1=52.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=25.0,tp=25.0,offset=0.5,expiry=4)
EXPECTED={"method":"CANDLE_ENGULFING f89/s144 p1=52.0 p2=52.0 p3=1.0 off=0.5 exp=4","config_hash":"92b6ef7e7d74ef51fb9031676bc4920edb2040775ff02599c92b811a01227dd4","trades":149,"win_rate_pct":63.758389261744966,"profit_factor":1.193872460496794,"net_profit_usd":31656.38600000002,"ev_per_trade_usd":212.45896644295317,"max_dd_pct":58.396729825020735,"sqn":1.0508575950362646,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
