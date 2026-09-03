from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=10,p1=1.1,p2=0.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=25.0,offset=2.0,expiry=8)
EXPECTED={"method":"VOLATILITY_REGIME f5/s10 p1=1.1 p2=0.8 p3=1.0 off=2.0 exp=8","config_hash":"1380c6bcc6b5d5a59b0c46d59acb87eb33d707cabab57a50f4a4caade962b11c","trades":189,"win_rate_pct":62.96296296296296,"profit_factor":1.1862774448808795,"net_profit_usd":38740.362000000074,"ev_per_trade_usd":204.97546031746072,"max_dd_pct":44.95189518397851,"sqn":1.0830299737956846,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
