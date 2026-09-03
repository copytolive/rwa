from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='KELTNER_SQUEEZE',fast=50,slow=89,p1=0.9,p2=1.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=18.0,offset=1.5,expiry=8)
EXPECTED={"method":"KELTNER_SQUEEZE f50/s89 p1=0.9 p2=1.0 p3=1.0 off=1.5 exp=8","config_hash":"51ecdce7cf20c9e7917438e5463abfc44a7037eed9ca7ed065ee3c1cbff89848","trades":100,"win_rate_pct":75.0,"profit_factor":1.2882010783261433,"net_profit_usd":20978.381,"ev_per_trade_usd":209.78381000000002,"max_dd_pct":44.62268910975672,"sqn":1.136540200915414,"sl_pips":2350.0,"tp_pips":1800.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
