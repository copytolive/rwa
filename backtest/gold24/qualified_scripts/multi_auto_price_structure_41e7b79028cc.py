from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='PRICE_STRUCTURE',fast=8,slow=100,p1=58.0,p2=58.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=15.5,tp=25.0,offset=1.5,expiry=10)
EXPECTED={"method":"PRICE_STRUCTURE f8/s100 p1=58.0 p2=58.0 p3=1.0 off=1.5 exp=10","config_hash":"41e7b79028cc2ae138c26e2a1fcc2e4fd8f31715c94dacdf78ea3bbf2dd3ec93","trades":148,"win_rate_pct":54.054054054054056,"profit_factor":1.1434405166944288,"net_profit_usd":21591.720000000038,"ev_per_trade_usd":145.89000000000024,"max_dd_pct":57.95299545103478,"sqn":0.7355204207094187,"sl_pips":1550.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
