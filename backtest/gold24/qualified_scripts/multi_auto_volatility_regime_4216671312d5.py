from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=10,p1=1.3,p2=0.9,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=2.5,expiry=11)
EXPECTED={"method":"VOLATILITY_REGIME f5/s10 p1=1.3 p2=0.9 p3=1.0 off=2.5 exp=11","config_hash":"4216671312d50c299a98dbc7fd810c480800cf792e5a6d618a6cfd96198b7dd5","trades":127,"win_rate_pct":63.77952755905512,"profit_factor":1.1818045540460254,"net_profit_usd":25798.564000000013,"ev_per_trade_usd":203.13829921259853,"max_dd_pct":37.72180711426417,"sqn":0.9085646490192029,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
