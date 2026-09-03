from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=21,p1=1.5,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.0,tp=21.5,offset=2.75,expiry=12)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s21 p1=1.5 p2=40.0 p3=1.0 off=2.75 exp=12","config_hash":"76a9e2f74712808d5039e41d5f277e4fede73d05f68371f3dcf4b141adf77da0","trades":118,"win_rate_pct":63.559322033898304,"profit_factor":1.1791732507822426,"net_profit_usd":20240.543500000025,"ev_per_trade_usd":171.53002966101715,"max_dd_pct":49.758327031116366,"sqn":0.8703115055212531,"sl_pips":2100.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
