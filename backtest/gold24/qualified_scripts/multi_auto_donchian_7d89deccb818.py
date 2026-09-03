from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=3,slow=100,p1=55.0,p2=58.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=20.5,tp=23.5,offset=3.25,expiry=9)
EXPECTED={"method":"DONCHIAN f3/s100 p1=55.0 p2=58.0 p3=1.0 off=3.25 exp=9","config_hash":"7d89deccb818740bd8cd11a8913439bdc20512c04fa326faa90e5ba93309f9fc","trades":124,"win_rate_pct":63.70967741935484,"profit_factor":1.263432739705825,"net_profit_usd":30907.698500000013,"ev_per_trade_usd":249.25563306451625,"max_dd_pct":36.29386689848074,"sqn":1.2676910288252081,"sl_pips":2050.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
