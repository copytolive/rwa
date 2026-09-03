from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=34,slow=144,p1=66.0,p2=58.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=22.0,tp=24.0,offset=1.75,expiry=10)
EXPECTED={"method":"CANDLE_ENGULFING f34/s144 p1=66.0 p2=58.0 p3=1.0 off=1.75 exp=10","config_hash":"7a11760c49f5b9f030703bad55649258355b18dea4bc1971c43ae33553a13b64","trades":158,"win_rate_pct":63.29113924050633,"profit_factor":1.2694217929937568,"net_profit_usd":41982.042000000016,"ev_per_trade_usd":265.7091265822786,"max_dd_pct":40.43522519854717,"sqn":1.4648845609683883,"sl_pips":2200,"tp_pips":2400}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
