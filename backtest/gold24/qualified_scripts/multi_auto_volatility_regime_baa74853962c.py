from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=14,slow=20,p1=1.05,p2=0.9,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=18.0,tp=24.5,offset=1.0,expiry=7)
EXPECTED={"method":"VOLATILITY_REGIME f14/s20 p1=1.05 p2=0.9 p3=1.0 off=1.0 exp=7","config_hash":"baa74853962cc3f30213b3e33aa0f5c7bc8216c6c63ba435afdd1515ee96492d","trades":113,"win_rate_pct":56.63716814159292,"profit_factor":1.1730259505210483,"net_profit_usd":20592.034999999993,"ev_per_trade_usd":182.23039823008844,"max_dd_pct":49.10996455898024,"sqn":0.7586738068726872,"sl_pips":1800.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
