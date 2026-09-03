from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BAND_HYBRID',fast=20,slow=21,p1=2.0,p2=2.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=25.0,offset=0.75,expiry=6)
EXPECTED={"method":"BAND_HYBRID f20/s21 p1=2.0 p2=2.0 p3=1.0 off=0.75 exp=6","config_hash":"8c2b4f9e83e39e8c4d913973b77a7b118c42b9c0398e8f827d19a05c69ba0adf","trades":101,"win_rate_pct":65.34653465346534,"profit_factor":1.2986635934435602,"net_profit_usd":30744.924000000043,"ev_per_trade_usd":304.4051881188123,"max_dd_pct":35.39236498800196,"sqn":1.2706438391258357,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
