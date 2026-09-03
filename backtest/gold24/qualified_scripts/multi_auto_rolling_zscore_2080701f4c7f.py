from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=5,slow=50,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=1.25,expiry=11)
EXPECTED={"method":"ROLLING_ZSCORE f5/s50 p1=2.1 p2=55.0 p3=1.0 off=1.25 exp=11","config_hash":"2080701f4c7ffd612ee0e328ce18d38307fe0cf622722e8dca8ed856aa15ff92","trades":120,"win_rate_pct":65.0,"profit_factor":1.2220002960323388,"net_profit_usd":28549.419000000013,"ev_per_trade_usd":237.9118250000001,"max_dd_pct":39.50575250901515,"sqn":1.062908165019065,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
