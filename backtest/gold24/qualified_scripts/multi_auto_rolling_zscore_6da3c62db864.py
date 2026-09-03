from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=7,slow=34,p1=1.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=25.0,offset=2.25,expiry=10)
EXPECTED={"method":"ROLLING_ZSCORE f7/s34 p1=1.7 p2=55.0 p3=1.0 off=2.25 exp=10","config_hash":"6da3c62db864994753b78eaa40fa78c00ab23b9e8f1ea6399dc20dea2adcc9e5","trades":152,"win_rate_pct":63.81578947368421,"profit_factor":1.1715856022622528,"net_profit_usd":28634.090000000004,"ev_per_trade_usd":188.3821710526316,"max_dd_pct":53.56661394196847,"sqn":0.9462698562898613,"sl_pips":2450.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
