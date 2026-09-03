from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=26,p1=1.8,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.0,tp=24.5,offset=0.5,expiry=6)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s26 p1=1.8 p2=40.0 p3=1.0 off=0.5 exp=6","config_hash":"df97f07820361e30fd7b7ce8781c171c3ae626450603a4fb19fa693b7021d7f1","trades":102,"win_rate_pct":58.8235294117647,"profit_factor":1.335005224288445,"net_profit_usd":33504.44400000001,"ev_per_trade_usd":328.4749411764707,"max_dd_pct":37.760366150104794,"sqn":1.3722062788938028,"sl_pips":1900.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
