from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=21,p1=1.5,p2=35.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=18.0,tp=18.0,offset=0.5,expiry=6)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s21 p1=1.5 p2=35.0 p3=1.0 off=0.5 exp=6","config_hash":"cbe1769e07ff552dc912b4ab7f006f5f274996a71b98b92dea30b73a492b6bbd","trades":101,"win_rate_pct":67.32673267326733,"profit_factor":1.390452590928562,"net_profit_usd":29851.760000000024,"ev_per_trade_usd":295.56198019802,"max_dd_pct":53.879793104402886,"sqn":1.4617849774458185,"sl_pips":1800.0,"tp_pips":1800.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
