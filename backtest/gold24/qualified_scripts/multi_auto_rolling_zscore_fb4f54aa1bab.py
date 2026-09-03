from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=20,slow=89,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=17.5,tp=25.0,offset=0.75,expiry=8)
EXPECTED={"method":"ROLLING_ZSCORE f20/s89 p1=2.1 p2=55.0 p3=1.0 off=0.75 exp=8","config_hash":"fb4f54aa1baba0f0281ac4e9c345acbe5f880d0268214759820470ba2f7d939e","trades":101,"win_rate_pct":59.40594059405941,"profit_factor":1.2928683614836611,"net_profit_usd":27688.84649999999,"ev_per_trade_usd":274.1469950495048,"max_dd_pct":33.71995676945754,"sqn":1.2743763715539944,"sl_pips":1750.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
