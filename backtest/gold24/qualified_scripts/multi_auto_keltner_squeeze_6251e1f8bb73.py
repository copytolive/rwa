from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='KELTNER_SQUEEZE',fast=34,slow=144,p1=1.0,p2=1.2,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=24.5,offset=2.5,expiry=5)
EXPECTED={"method":"KELTNER_SQUEEZE f34/s144 p1=1.0 p2=1.2 p3=1.0 off=2.5 exp=5","config_hash":"6251e1f8bb7302e43e7726b1090374c40a73d1bcd13d085cf5fb1a4bad49d307","trades":200,"win_rate_pct":63.0,"profit_factor":1.1278398281408042,"net_profit_usd":27828.836000000047,"ev_per_trade_usd":139.14418000000023,"max_dd_pct":44.13121649062109,"sqn":0.8226593860634933,"sl_pips":2350.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
