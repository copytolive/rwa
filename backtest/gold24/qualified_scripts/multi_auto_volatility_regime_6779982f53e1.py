from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=3,slow=100,p1=1.3,p2=0.6,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=25.0,offset=1.25,expiry=8)
EXPECTED={"method":"VOLATILITY_REGIME f3/s100 p1=1.3 p2=0.6 p3=1.0 off=1.25 exp=8","config_hash":"6779982f53e1496a68cf9f7b9dcba3a221a6e193f332002137616ccdfa4e6e7f","trades":135,"win_rate_pct":62.96296296296296,"profit_factor":1.2232732647713367,"net_profit_usd":33307.888000000035,"ev_per_trade_usd":246.72509629629656,"max_dd_pct":38.92228731696557,"sqn":1.064759851629907,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
