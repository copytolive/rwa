from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=10,slow=21,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=18.5,tp=22.0,offset=4.75,expiry=9)
EXPECTED={"method":"CHART_PATTERN f10/s21 p1=1.0 p2=55.0 p3=1.0 off=4.75 exp=9","config_hash":"e1a6594ac26351bfce971046f546a2741711042fc21d5429ba03392758321538","trades":108,"win_rate_pct":61.111111111111114,"profit_factor":1.2558776606049555,"net_profit_usd":25081.681499999973,"ev_per_trade_usd":232.23779166666642,"max_dd_pct":48.66125274325852,"sqn":1.143417150400414,"sl_pips":1850.0,"tp_pips":2200.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
