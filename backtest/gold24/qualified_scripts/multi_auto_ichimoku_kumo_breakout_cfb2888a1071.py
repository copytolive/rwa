from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ICHIMOKU_KUMO_BREAKOUT',fast=8,slow=100,p1=0.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.5,tp=17.0,offset=1.0,expiry=9)
EXPECTED={"method":"ICHIMOKU_KUMO_BREAKOUT f8/s100 p1=0.2 p2=55.0 p3=1.0 off=1.0 exp=9","config_hash":"cfb2888a1071bbcca59cad3c5a3079531f403d773259314e618a5036e7ffe424","trades":101,"win_rate_pct":73.26732673267327,"profit_factor":1.3356017659705681,"net_profit_usd":23586.47000000001,"ev_per_trade_usd":233.52940594059413,"max_dd_pct":61.68414403092153,"sqn":1.3511821409373712,"sl_pips":2150.0,"tp_pips":1700.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
