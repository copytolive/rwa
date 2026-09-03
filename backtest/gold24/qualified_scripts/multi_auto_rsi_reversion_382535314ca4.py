from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='RSI_REVERSION',fast=20,slow=26,p1=35.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=23.5,offset=4.25,expiry=7)
EXPECTED={"method":"RSI_REVERSION f20/s26 p1=35.0 p2=55.0 p3=1.0 off=4.25 exp=7","config_hash":"382535314ca4ed32467ca45c8710e91552ee13e9ec52a2b5fda49dc28d87d38f","trades":119,"win_rate_pct":61.34453781512605,"profit_factor":1.1734202880556694,"net_profit_usd":22253.20500000002,"ev_per_trade_usd":187.0017226890758,"max_dd_pct":43.89087974162532,"sqn":0.8236987015287098,"sl_pips":2250.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
