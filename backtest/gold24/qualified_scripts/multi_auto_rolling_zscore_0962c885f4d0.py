from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=34,slow=89,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=17.0,tp=19.0,offset=4.25,expiry=8)
EXPECTED={"method":"ROLLING_ZSCORE f34/s89 p1=2.1 p2=55.0 p3=1.0 off=4.25 exp=8","config_hash":"0962c885f4d006281ac9bca4afcdd1856157321ba1ae72e0d4811cd48bfc402f","trades":101,"win_rate_pct":67.32673267326733,"profit_factor":1.3162180653334212,"net_profit_usd":23922.490500000007,"ev_per_trade_usd":236.85634158415849,"max_dd_pct":47.718593921763286,"sqn":1.3277503876524366,"sl_pips":1700.0,"tp_pips":1900.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
