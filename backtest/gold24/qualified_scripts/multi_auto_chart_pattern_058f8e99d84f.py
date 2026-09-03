from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=3,slow=26,p1=0.7,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=16.0,tp=20.5,offset=5.0,expiry=7)
EXPECTED={"method":"CHART_PATTERN f3/s26 p1=0.7 p2=55.0 p3=1.0 off=5.0 exp=7","config_hash":"058f8e99d84fcff87925844b003f5e28cc361f70fec344f55a6c8c64b232b15b","trades":134,"win_rate_pct":61.19402985074627,"profit_factor":1.1982880377083065,"net_profit_usd":21810.959999999992,"ev_per_trade_usd":162.76835820895516,"max_dd_pct":30.57253582682557,"sqn":1.0240415593924905,"sl_pips":1600.0,"tp_pips":2050.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
