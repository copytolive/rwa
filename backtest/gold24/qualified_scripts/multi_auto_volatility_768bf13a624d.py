from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY',fast=3,slow=13,p1=1.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=24.5,offset=2.0,expiry=11)
EXPECTED={"method":"VOLATILITY f3/s13 p1=1.2 p2=55.0 p3=1.0 off=2.0 exp=11","config_hash":"768bf13a624db8c64c72d4fdc5db08b68c9cbb9372a67d8bfa83d598e82d73c8","trades":137,"win_rate_pct":62.77372262773723,"profit_factor":1.2509240986201946,"net_profit_usd":36773.56400000005,"ev_per_trade_usd":268.4201751824821,"max_dd_pct":41.35717013050976,"sqn":1.1857471202108665,"sl_pips":2300.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
