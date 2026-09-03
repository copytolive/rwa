from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=14,p1=1.5,p2=25.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=19.5,tp=23.0,offset=0.5,expiry=4)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s14 p1=1.5 p2=25.0 p3=1.0 off=0.5 exp=4","config_hash":"7ef8a96712bb1fbfe48aae1c932cb47bcc08e293e28343fd928743d159b9e68e","trades":102,"win_rate_pct":60.78431372549019,"profit_factor":1.2322677467182956,"net_profit_usd":22648.693000000017,"ev_per_trade_usd":222.04600980392175,"max_dd_pct":38.41378469922949,"sqn":1.037854664469071,"sl_pips":1950.0,"tp_pips":2300.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
