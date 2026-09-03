from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=14,p1=1.5,p2=25.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=20.0,offset=0.75,expiry=9)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s14 p1=1.5 p2=25.0 p3=1.0 off=0.75 exp=9","config_hash":"2f5b82db00e32bad6ee43435f9e93a7e24863007a1981bfbcf4b30d7fcfd9d3b","trades":100,"win_rate_pct":71.0,"profit_factor":1.3860252219961067,"net_profit_usd":32704.952000000027,"ev_per_trade_usd":327.04952000000026,"max_dd_pct":27.1063076443382,"sqn":1.553790632134875,"sl_pips":2400.0,"tp_pips":2000.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
