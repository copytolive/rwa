from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_SQUEEZE',fast=20,slow=21,p1=0.05,p2=1.5,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=24.5,offset=0.75,expiry=12)
EXPECTED={"method":"BOLLINGER_SQUEEZE f20/s21 p1=0.05 p2=1.5 p3=1.0 off=0.75 exp=12","config_hash":"588ca61ecb5250e0988185be9f03d22d051c2ff4236f7f143b4bbace5fbdbd8b","trades":133,"win_rate_pct":64.66165413533835,"profit_factor":1.2650301563659425,"net_profit_usd":36621.50100000007,"ev_per_trade_usd":275.3496315789479,"max_dd_pct":33.85909124709669,"sqn":1.3187011463313132,"sl_pips":2400.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
