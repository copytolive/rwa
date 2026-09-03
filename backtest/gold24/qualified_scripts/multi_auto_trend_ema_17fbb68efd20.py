from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='TREND_EMA',fast=26,slow=55,p1=66.0,p2=52.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=24.0,offset=5.0,expiry=8)
EXPECTED={"method":"TREND_EMA f26/s55 p1=66.0 p2=52.0 p3=1.0 off=5.0 exp=8","config_hash":"17fbb68efd20a257b552f4fc41cacacdb5adb6aed8532a1d83aa57259afecb85","trades":244,"win_rate_pct":60.24590163934426,"profit_factor":1.086296160661848,"net_profit_usd":25105.587999999996,"ev_per_trade_usd":102.89175409836064,"max_dd_pct":50.542109594122444,"sqn":0.5368179614863898,"sl_pips":2350.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
