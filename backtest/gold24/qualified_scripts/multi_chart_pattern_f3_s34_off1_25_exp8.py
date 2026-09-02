from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CHART_PATTERN",fast=3,slow=34,p1=0.7,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=23.5,tp=24.0,offset=1.25,expiry=8)
EXPECTED={"method":"CHART_PATTERN f3/s34 p1=0.7 p2=55.0 p3=1.0 off=1.25 exp=8","config_hash":"4ff55b7bfa26f3cd3778faa661704fa1b1ed2e7767a249e5eab593352ca1b514","trades":105,"win_rate_pct":65.71428571428571,"profit_factor":1.318551418315105,"net_profit_usd":33069.520999999986,"ev_per_trade_usd":314.9478190476189,"max_dd_pct":41.88309621949517,"sqn":1.3770083934079176,"sl_pips":2350.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
