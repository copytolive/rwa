from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=7,p1=1.05,p2=0.6,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=24.5,offset=4.25,expiry=12)
EXPECTED={"method":"VOLATILITY_REGIME f5/s7 p1=1.05 p2=0.6 p3=1.0 off=4.25 exp=12","config_hash":"319f7365aa2b458a59b654498db4b07de0a7b3ea58a6ac97f75894d9b9896b21","trades":197,"win_rate_pct":60.91370558375635,"profit_factor":1.1361290018158698,"net_profit_usd":29677.80250000005,"ev_per_trade_usd":150.6487436548226,"max_dd_pct":51.5734856255582,"sqn":0.8281719846297735,"sl_pips":2300.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
