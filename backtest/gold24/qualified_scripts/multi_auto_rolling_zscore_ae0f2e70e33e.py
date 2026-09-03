from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=7,slow=50,p1=1.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=25.0,offset=2.0,expiry=7)
EXPECTED={"method":"ROLLING_ZSCORE f7/s50 p1=1.7 p2=55.0 p3=1.0 off=2.0 exp=7","config_hash":"ae0f2e70e33eb62e246b84d3c830d8297f545eb7cbb573808a920b846942bb25","trades":146,"win_rate_pct":63.013698630136986,"profit_factor":1.1378869952509125,"net_profit_usd":22418.201999999976,"ev_per_trade_usd":153.54932876712311,"max_dd_pct":44.23496361705827,"sqn":0.7565979016655321,"sl_pips":2450.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
