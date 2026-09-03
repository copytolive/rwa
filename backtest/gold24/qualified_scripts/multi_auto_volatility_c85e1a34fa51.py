from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY',fast=3,slow=13,p1=1.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=1.75,expiry=2)
EXPECTED={"method":"VOLATILITY f3/s13 p1=1.2 p2=55.0 p3=1.0 off=1.75 exp=2","config_hash":"c85e1a34fa51c31b84a0d339a6b552d74d0087b095379ed63acaef7157d5539d","trades":140,"win_rate_pct":65.71428571428571,"profit_factor":1.3085929931824536,"net_profit_usd":44686.94400000009,"ev_per_trade_usd":319.1924571428578,"max_dd_pct":35.877767662514586,"sqn":1.4381119768771378,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
