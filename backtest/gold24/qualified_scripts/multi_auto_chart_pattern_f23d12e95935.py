from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=10,p1=0.5,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=1.25,expiry=3)
EXPECTED={"method":"CHART_PATTERN f5/s10 p1=0.5 p2=55.0 p3=1.0 off=1.25 exp=3","config_hash":"f23d12e95935bbccb64b50925058a0e251df137d9a30dd4c60e3fd2f4ef4e743","trades":111,"win_rate_pct":68.46846846846847,"profit_factor":1.4436366605669364,"net_profit_usd":46365.234000000004,"ev_per_trade_usd":417.70481081081084,"max_dd_pct":33.0284490173618,"sqn":1.8840417148744641,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
