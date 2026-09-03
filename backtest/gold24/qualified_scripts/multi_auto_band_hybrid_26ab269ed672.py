from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BAND_HYBRID',fast=14,slow=34,p1=2.0,p2=1.5,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=25.0,offset=1.5,expiry=8)
EXPECTED={"method":"BAND_HYBRID f14/s34 p1=2.0 p2=1.5 p3=1.0 off=1.5 exp=8","config_hash":"26ab269ed672528c55077095a1e0e80ddea303d89378b7993905de2e66aa85a9","trades":118,"win_rate_pct":68.64406779661017,"profit_factor":1.3994426180048927,"net_profit_usd":45788.03700000007,"ev_per_trade_usd":388.0342118644074,"max_dd_pct":24.139444530795025,"sqn":1.7656487846555629,"sl_pips":2450.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
