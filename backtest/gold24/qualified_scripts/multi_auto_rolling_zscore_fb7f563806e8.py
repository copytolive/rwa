from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=3,slow=8,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=0.5,expiry=4)
EXPECTED={"method":"ROLLING_ZSCORE f3/s8 p1=2.1 p2=55.0 p3=1.0 off=0.5 exp=4","config_hash":"fb7f563806e87d7780b3385431665ddc8cdc9c76532ee92d05cee3fb1bb05016","trades":124,"win_rate_pct":63.70967741935484,"profit_factor":1.2026121746766045,"net_profit_usd":26693.005000000016,"ev_per_trade_usd":215.26616935483884,"max_dd_pct":62.38489252580797,"sqn":0.9929682773150447,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
