from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=26,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.5,tp=24.5,offset=3.5,expiry=12)
EXPECTED={"method":"CHART_PATTERN f5/s26 p1=0.7 p2=55.0 p3=1.0 off=3.5 exp=12","config_hash":"b23808c8543027d13fef502876c1d83ae1244d72e561f1e9e73c1b8895d25b9d","trades":100,"win_rate_pct":66.0,"profit_factor":1.587431360075324,"net_profit_usd":48873.932,"ev_per_trade_usd":488.73932,"max_dd_pct":15.491260334047679,"sqn":2.2959940703802784,"sl_pips":1950.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
