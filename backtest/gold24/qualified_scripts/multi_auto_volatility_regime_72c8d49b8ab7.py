from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=7,slow=10,p1=1.05,p2=0.6,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=24.5,offset=1.0,expiry=4)
EXPECTED={"method":"VOLATILITY_REGIME f7/s10 p1=1.05 p2=0.6 p3=1.0 off=1.0 exp=4","config_hash":"72c8d49b8ab75fb4f302ea12d8c9840f476c733d2cdfbc41990665f3b3a976e6","trades":167,"win_rate_pct":62.874251497005986,"profit_factor":1.1526599799790946,"net_profit_usd":28397.742000000042,"ev_per_trade_usd":170.0463592814374,"max_dd_pct":47.55743602689249,"sqn":0.8386529539905638,"sl_pips":2400.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
