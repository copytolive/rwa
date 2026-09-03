from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=3,slow=20,p1=1.3,p2=0.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=1.5,expiry=7)
EXPECTED={"method":"VOLATILITY_REGIME f3/s20 p1=1.3 p2=0.8 p3=1.0 off=1.5 exp=7","config_hash":"173c00588932ed4d755e7a69964bb17a1a750c3929595bc461e9183e9ef95885","trades":190,"win_rate_pct":64.73684210526316,"profit_factor":1.2705611726119515,"net_profit_usd":54587.696000000054,"ev_per_trade_usd":287.303663157895,"max_dd_pct":44.82508700370466,"sqn":1.5246851158275925,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
