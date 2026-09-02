from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="BOLLINGER_REVERSION_V2",fast=3,slow=14,p1=1.5,p2=30.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=21.0,tp=25.0,offset=1.25,expiry=4)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f3/s14 p1=1.5 p2=30.0 p3=1.0 off=1.25 exp=4","config_hash":"5b32ea7bda5439f27bc176bed6866ff72c74a109e0e7d51170a205d580017a81","trades":107,"win_rate_pct":60.74766355140187,"profit_factor":1.3168676340412486,"net_profit_usd":33597.39000000003,"ev_per_trade_usd":313.9942990654208,"max_dd_pct":46.68105729694503,"sqn":1.4108842513684676,"sl_pips":2100.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
