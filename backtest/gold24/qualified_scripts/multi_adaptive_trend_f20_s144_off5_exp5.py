from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="ADAPTIVE_TREND",fast=20,slow=144,p1=2.2,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=22.5,tp=24.5,offset=5.0,expiry=5)
EXPECTED={"method":"ADAPTIVE_TREND f20/s144 p1=2.2 p2=55.0 p3=1.0 off=5.0 exp=5","config_hash":"d3844bec737310d796a696cb50450f11295e7cb85580a619237f2e32f560a4c4","trades":194,"win_rate_pct":61.34020618556701,"profit_factor":1.1084819799017729,"net_profit_usd":23313.430000000077,"ev_per_trade_usd":120.17231958762926,"max_dd_pct":53.21914115088332,"sqn":0.6565683116225519,"sl_pips":2250.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
