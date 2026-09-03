from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='MULTI_TIMEFRAME',fast=20,slow=100,p1=62.0,p2=62.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=24.0,offset=4.5,expiry=11)
EXPECTED={"method":"MULTI_TIMEFRAME f20/s100 p1=62.0 p2=62.0 p3=1.0 off=4.5 exp=11","config_hash":"52eb9b5948c9b7012d4d2fbad9a82f26cd4ef6c1e1364a2103afc9d0f84a00f9","trades":344,"win_rate_pct":61.91860465116279,"profit_factor":1.0597196708543726,"net_profit_usd":24495.53999999992,"ev_per_trade_usd":71.20796511627884,"max_dd_pct":52.917797996624415,"sqn":0.4683279703470426,"sl_pips":2500.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
