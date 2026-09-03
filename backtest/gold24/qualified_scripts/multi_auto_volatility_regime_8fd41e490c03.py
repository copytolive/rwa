from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=20,slow=21,p1=1.5,p2=1.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=2.5,expiry=10)
EXPECTED={"method":"VOLATILITY_REGIME f20/s21 p1=1.5 p2=1.0 p3=1.0 off=2.5 exp=10","config_hash":"8fd41e490c0355123d4fdf92db9a94b851ba8dcb87345b2eaa3289c4696488b2","trades":142,"win_rate_pct":62.67605633802817,"profit_factor":1.166416146598386,"net_profit_usd":26261.42,"ev_per_trade_usd":184.93957746478873,"max_dd_pct":42.992198716424085,"sqn":0.8941337432645712,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
