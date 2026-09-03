from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=20,p1=1.5,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=17.0,tp=17.5,offset=4.5,expiry=6)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s20 p1=1.5 p2=40.0 p3=1.0 off=4.5 exp=6","config_hash":"a08b9dcbef20667971fb74fc2b3fcd918d322f81761119ee1a3acf36b47a1f18","trades":113,"win_rate_pct":67.2566371681416,"profit_factor":1.2386265691588294,"net_profit_usd":20257.59600000001,"ev_per_trade_usd":179.27076106194698,"max_dd_pct":40.851114139990116,"sqn":1.0842046034618875,"sl_pips":1700.0,"tp_pips":1750.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
