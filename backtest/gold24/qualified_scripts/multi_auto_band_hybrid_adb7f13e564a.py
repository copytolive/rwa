from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BAND_HYBRID',fast=5,slow=13,p1=1.0,p2=1.5,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=24.5,offset=1.0,expiry=4)
EXPECTED={"method":"BAND_HYBRID f5/s13 p1=1.0 p2=1.5 p3=1.0 off=1.0 exp=4","config_hash":"adb7f13e564aa84c602bb29fb8f74af3f9033c97b17708d4f1748e0614455a87","trades":128,"win_rate_pct":63.28125,"profit_factor":1.1990424023800745,"net_profit_usd":26915.978999999992,"ev_per_trade_usd":210.28108593749994,"max_dd_pct":48.03575010182734,"sqn":1.00026947908126,"sl_pips":2300.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
