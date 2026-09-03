from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=3,slow=100,p1=0.5,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=24.5,offset=1.5,expiry=12)
EXPECTED={"method":"ROLLING_ZSCORE f3/s100 p1=0.5 p2=55.0 p3=1.0 off=1.5 exp=12","config_hash":"cc52c95378b7e7b239c871cd2b77689c087b082649f05ef9b7b2ec3b9946f5ec","trades":108,"win_rate_pct":62.96296296296296,"profit_factor":1.2423671737962596,"net_profit_usd":26865.899999999983,"ev_per_trade_usd":248.75833333333318,"max_dd_pct":66.5426391417032,"sqn":1.1013703667331975,"sl_pips":2300.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
