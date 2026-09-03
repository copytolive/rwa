from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIB_PULLBACK',fast=5,slow=8,p1=0.382,p2=5.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=25.0,offset=2.0,expiry=7)
EXPECTED={"method":"FIB_PULLBACK f5/s8 p1=0.382 p2=5.0 p3=1.0 off=2.0 exp=7","config_hash":"0fe793f15f2d580c87d5a6f2da1c327efed9c9c018ae5ffe1cdb93a2ab5c34bc","trades":112,"win_rate_pct":63.392857142857146,"profit_factor":1.3125590390349269,"net_profit_usd":36267.94999999997,"ev_per_trade_usd":323.82098214285685,"max_dd_pct":26.11289225325762,"sqn":1.4065459747304472,"sl_pips":2300.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
