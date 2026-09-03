from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=3,slow=55,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=23.5,offset=1.75,expiry=4)
EXPECTED={"method":"CHART_PATTERN f3/s55 p1=1.0 p2=55.0 p3=1.0 off=1.75 exp=4","config_hash":"47a77e6bf04ab4af50ded9840d0de741b4b85113ba2ff7cee4256cb065245a45","trades":102,"win_rate_pct":64.70588235294117,"profit_factor":1.270859769005982,"net_profit_usd":27418.496,"ev_per_trade_usd":268.8087843137255,"max_dd_pct":43.467297998514766,"sqn":1.1778640378930179,"sl_pips":2300.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
