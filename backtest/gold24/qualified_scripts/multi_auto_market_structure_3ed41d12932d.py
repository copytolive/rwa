from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='MARKET_STRUCTURE',fast=13,slow=50,p1=66.0,p2=62.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=4.75,expiry=12)
EXPECTED={"method":"MARKET_STRUCTURE f13/s50 p1=66.0 p2=62.0 p3=1.0 off=4.75 exp=12","config_hash":"3ed41d12932d82bef7f25bc01ffc2813e570e5181c5d9367e984afd0494b3412","trades":100,"win_rate_pct":63.0,"profit_factor":1.1908204982900055,"net_profit_usd":22002.50050000006,"ev_per_trade_usd":220.0250050000006,"max_dd_pct":50.98333222336956,"sqn":0.7690012409928909,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
