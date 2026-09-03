from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='REGRESSION_CHANNEL_BREAKOUT',fast=10,slow=21,p1=0.02,p2=1.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=4.25,expiry=8)
EXPECTED={"method":"REGRESSION_CHANNEL_BREAKOUT f10/s21 p1=0.02 p2=1.0 p3=1.0 off=4.25 exp=8","config_hash":"646ce27b699055e0853e47d5cdfc92a32df77d0fef2f3169772560d73a896fe2","trades":416,"win_rate_pct":60.09615384615385,"profit_factor":1.050058981711895,"net_profit_usd":26021.937,"ev_per_trade_usd":62.55273317307693,"max_dd_pct":59.46170857279442,"sqn":0.440003228101977,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
