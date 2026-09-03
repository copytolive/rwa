from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIBONACCI',fast=8,slow=13,p1=0.786,p2=8.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=4.75,expiry=12)
EXPECTED={"method":"FIBONACCI f8/s13 p1=0.786 p2=8.0 p3=1.0 off=4.75 exp=12","config_hash":"65a90f7223f1c474bea6b231c12a368ab54a40067515ee3eb11cada7b64b7b71","trades":198,"win_rate_pct":62.121212121212125,"profit_factor":1.1612669484798221,"net_profit_usd":36635.07299999994,"ev_per_trade_usd":185.0256212121209,"max_dd_pct":45.547373993867986,"sqn":0.9888230294118111,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
