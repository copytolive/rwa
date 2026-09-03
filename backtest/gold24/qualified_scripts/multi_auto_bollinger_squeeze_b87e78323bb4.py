from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_SQUEEZE',fast=20,slow=21,p1=0.05,p2=1.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.5,tp=23.5,offset=1.0,expiry=8)
EXPECTED={"method":"BOLLINGER_SQUEEZE f20/s21 p1=0.05 p2=1.8 p3=1.0 off=1.0 exp=8","config_hash":"b87e78323bb4ef31a472300dea040ec9abe1892ce24c5d7ffa5032e7c190b1c6","trades":101,"win_rate_pct":64.35643564356435,"profit_factor":1.30533976203979,"net_profit_usd":29407.365000000078,"ev_per_trade_usd":291.1620297029711,"max_dd_pct":32.93933870920595,"sqn":1.300941323682473,"sl_pips":2150.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
