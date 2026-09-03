from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIBONACCI',fast=13,slow=20,p1=0.786,p2=5.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=17.5,tp=24.5,offset=1.25,expiry=12)
EXPECTED={"method":"FIBONACCI f13/s20 p1=0.786 p2=5.0 p3=1.0 off=1.25 exp=12","config_hash":"0daf3fd68aaf0c76529a7ca4f42b694fc4757a6fd9a05a80ba884ac2c08aa988","trades":153,"win_rate_pct":54.90196078431372,"profit_factor":1.1346138733617737,"net_profit_usd":20930.749999999953,"ev_per_trade_usd":136.80228758169903,"max_dd_pct":70.85959448730078,"sqn":0.7477041945199218,"sl_pips":1750.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
