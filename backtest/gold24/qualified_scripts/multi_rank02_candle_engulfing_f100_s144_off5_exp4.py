from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=100,slow=144,p1=66.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=21.0,tp=25.0,offset=5.0,expiry=4)
EXPECTED={"method":"CANDLE_ENGULFING f100/s144 p1=66.0 p2=52.0 p3=1.0 off=5.0 exp=4","config_hash":"19b16bbde8f2edb8f9ab7a699cf228e3d6d1f2b47ca32ac0aed6408cae7caefc","trades":135,"win_rate_pct":63.7037037037037,"profit_factor":1.359893221287339,"net_profit_usd":46316.03200000003,"ev_per_trade_usd":343.08171851851876,"max_dd_pct":36.8235989095856,"sqn":1.7567858005944361,"sl_pips":2100.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
