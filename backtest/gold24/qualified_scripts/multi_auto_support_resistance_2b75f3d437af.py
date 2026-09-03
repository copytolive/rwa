from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=21,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=20.0,tp=25.0,offset=4.25,expiry=6)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s21 p1=0.7 p2=55.0 p3=1.0 off=4.25 exp=6","config_hash":"2b75f3d437af4ca75cf3467448e2eb2c2149afc1c77ec8fc70caf2c7be322baa","trades":115,"win_rate_pct":66.08695652173913,"profit_factor":1.6551946226491985,"net_profit_usd":63992.82799999996,"ev_per_trade_usd":556.4593739130431,"max_dd_pct":20.017619037911377,"sqn":2.6623482228314677,"sl_pips":2000.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
