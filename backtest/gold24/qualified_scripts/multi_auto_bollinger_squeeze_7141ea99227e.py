from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_SQUEEZE',fast=14,slow=21,p1=0.05,p2=1.8,p3=1.0,entry_method='STOP',direction_mode='LONG_ONLY',sl=22.5,tp=23.5,offset=1.75,expiry=9)
EXPECTED={"method":"BOLLINGER_SQUEEZE f14/s21 p1=0.05 p2=1.8 p3=1.0 off=1.75 exp=9","config_hash":"7141ea99227e1fbef3aa23de8e75456d8103683836af8c9a25432c7394441bc7","trades":122,"win_rate_pct":64.75409836065573,"profit_factor":1.1981868239117943,"net_profit_usd":24217.629999999997,"ev_per_trade_usd":198.5051639344262,"max_dd_pct":36.653705139265824,"sqn":0.9673667834109497,"sl_pips":2250.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
