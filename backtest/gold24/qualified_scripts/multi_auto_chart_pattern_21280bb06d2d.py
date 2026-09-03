from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=10,p1=0.5,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=1.0,expiry=2)
EXPECTED={"method":"CHART_PATTERN f5/s10 p1=0.5 p2=55.0 p3=1.0 off=1.0 exp=2","config_hash":"21280bb06d2d624ef280845d193e18a75f087523a14f16d2becfed1a0b6ca58f","trades":108,"win_rate_pct":67.5925925925926,"profit_factor":1.4040080398838957,"net_profit_usd":42756.325999999994,"ev_per_trade_usd":395.89190740740736,"max_dd_pct":35.956002340485554,"sqn":1.7188551954284006,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
