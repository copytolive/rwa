from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=34,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.0,tp=19.0,offset=2.25,expiry=8)
EXPECTED={"method":"CHART_PATTERN f5/s34 p1=1.0 p2=55.0 p3=1.0 off=2.25 exp=8","config_hash":"fe679a1d8c652f7fdeec58a605252c3eafdaa675547cdaebf587e0208285b650","trades":130,"win_rate_pct":72.3076923076923,"profit_factor":1.4017886713678256,"net_profit_usd":40336.18949999998,"ev_per_trade_usd":310.2783807692306,"max_dd_pct":31.195541135167538,"sqn":1.8117584031152494,"sl_pips":2300.0,"tp_pips":1900.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
