from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ATR_BREAKOUT',fast=3,slow=13,p1=2.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=4.75,expiry=5)
EXPECTED={"method":"ATR_BREAKOUT f3/s13 p1=2.2 p2=55.0 p3=1.0 off=4.75 exp=5","config_hash":"fc4e20ce0babcd2a343f39428f8f31ab9672782666835ef0f21fb9a9244f5463","trades":110,"win_rate_pct":66.36363636363636,"profit_factor":1.2401596040708467,"net_profit_usd":27544.49050000008,"ev_per_trade_usd":250.40445909090982,"max_dd_pct":46.07986286256217,"sqn":1.081808812763872,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
