from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=21,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=23.5,offset=4.25,expiry=12)
EXPECTED={"method":"CHART_PATTERN f5/s21 p1=1.0 p2=55.0 p3=1.0 off=4.25 exp=12","config_hash":"a021fdd7988da89db50529db9644abb9578c7bce2309b8200893bb00593913d5","trades":181,"win_rate_pct":61.87845303867403,"profit_factor":1.1618358877181296,"net_profit_usd":30765.95999999995,"ev_per_trade_usd":169.97767955801078,"max_dd_pct":46.605940195800756,"sqn":0.977460332247131,"sl_pips":2250.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
