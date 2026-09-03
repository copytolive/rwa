from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=3,slow=13,p1=1.5,p2=30.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=1.5,expiry=12)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f3/s13 p1=1.5 p2=30.0 p3=1.0 off=1.5 exp=12","config_hash":"96132f15801c09aa42d8a509e82d52c11f61c5cbc10f4f8d1c45a64c49f8ef50","trades":118,"win_rate_pct":66.10169491525424,"profit_factor":1.4181985517664057,"net_profit_usd":49863.635000000024,"ev_per_trade_usd":422.5731779661019,"max_dd_pct":28.32989142203173,"sqn":1.855401081808843,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
