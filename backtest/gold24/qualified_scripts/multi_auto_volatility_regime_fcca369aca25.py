from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=34,p1=1.3,p2=0.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=24.0,offset=1.75,expiry=2)
EXPECTED={"method":"VOLATILITY_REGIME f5/s34 p1=1.3 p2=0.8 p3=1.0 off=1.75 exp=2","config_hash":"fcca369aca257288253397d495567bd5ccb62e71669869f674876f641b35fdc0","trades":123,"win_rate_pct":61.78861788617886,"profit_factor":1.1580981668334087,"net_profit_usd":21062.618000000042,"ev_per_trade_usd":171.24079674796783,"max_dd_pct":78.47913035047934,"sqn":0.7275748558228069,"sl_pips":2300.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
