from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIB_PULLBACK',fast=3,slow=5,p1=0.382,p2=5.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=20.0,tp=21.0,offset=1.0,expiry=9)
EXPECTED={"method":"FIB_PULLBACK f3/s5 p1=0.382 p2=5.0 p3=1.0 off=1.0 exp=9","config_hash":"020e3c510250050b4212525c6ddea49393f0669748c85d591f7e67920a73c4b8","trades":132,"win_rate_pct":64.39393939393939,"profit_factor":1.2335626014703238,"net_profit_usd":27798.049999999945,"ev_per_trade_usd":210.59128787878745,"max_dd_pct":37.08529287524765,"sqn":1.1624818489004909,"sl_pips":2000.0,"tp_pips":2100.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
