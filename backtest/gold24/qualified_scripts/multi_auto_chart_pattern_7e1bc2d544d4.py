from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=34,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.0,tp=23.5,offset=2.5,expiry=6)
EXPECTED={"method":"CHART_PATTERN f5/s34 p1=1.0 p2=55.0 p3=1.0 off=2.5 exp=6","config_hash":"7e1bc2d544d46004cd8254e9021520720eb1b51dac0226bd971684e483c5b110","trades":125,"win_rate_pct":64.8,"profit_factor":1.3821237798943005,"net_profit_usd":43393.443,"ev_per_trade_usd":347.147544,"max_dd_pct":25.71261479826218,"sqn":1.7745765756460008,"sl_pips":2100.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
