from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=7,slow=14,p1=1.5,p2=30.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=16.5,tp=17.0,offset=4.75,expiry=5)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f7/s14 p1=1.5 p2=30.0 p3=1.0 off=4.75 exp=5","config_hash":"59d632be600589a90fe0a2a5fec7d34655bea502b13cb5faee8bc2e26e51684b","trades":121,"win_rate_pct":66.11570247933884,"profit_factor":1.227670503170499,"net_profit_usd":20262.07100000004,"ev_per_trade_usd":167.4551322314053,"max_dd_pct":25.177684186115123,"sqn":1.0666654008367833,"sl_pips":1650.0,"tp_pips":1700.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
