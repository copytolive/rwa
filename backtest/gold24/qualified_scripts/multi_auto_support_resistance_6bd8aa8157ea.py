from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=26,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.5,tp=16.5,offset=0.5,expiry=2)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s26 p1=0.7 p2=55.0 p3=1.0 off=0.5 exp=2","config_hash":"6bd8aa8157eadd342a4aa9dcc42ccb3da21170fb280abf2996e27d6f5dae7942","trades":107,"win_rate_pct":74.76635514018692,"profit_factor":1.3744194534546668,"net_profit_usd":27034.157999999996,"ev_per_trade_usd":252.65568224299062,"max_dd_pct":33.92818880764635,"sqn":1.518975889827874,"sl_pips":2150.0,"tp_pips":1650.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
