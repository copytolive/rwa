from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=26,slow=144,p1=1.4,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=16.5,tp=24.5,offset=0.5,expiry=3)
EXPECTED={"method":"VOLUME f26/s144 p1=1.4 p2=55.0 p3=1.0 off=0.5 exp=3","config_hash":"02ab34a779b8e66839c542cc1deb8ae33118ef5d6d111a367b47599eb3c885b1","trades":121,"win_rate_pct":53.71900826446281,"profit_factor":1.167081408909455,"net_profit_usd":20179.057999999997,"ev_per_trade_usd":166.76907438016528,"max_dd_pct":66.83600171226747,"sqn":0.7592004342698461,"sl_pips":1650.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
