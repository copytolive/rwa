from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=21,p1=1.8,p2=35.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=20.5,tp=24.5,offset=1.5,expiry=5)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s21 p1=1.8 p2=35.0 p3=1.0 off=1.5 exp=5","config_hash":"80eaeba7b3e3dd31d13040f98dddf53516be512a046212b9dc1b3f7b6649e6f5","trades":105,"win_rate_pct":60.0,"profit_factor":1.2139818792352066,"net_profit_usd":23225.31200000003,"ev_per_trade_usd":221.1934476190479,"max_dd_pct":40.60487109492083,"sqn":0.9794433148490979,"sl_pips":2050.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
