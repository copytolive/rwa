from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=3,slow=34,p1=62.0,p2=52.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=1.0,expiry=5)
EXPECTED={"method":"DONCHIAN f3/s34 p1=62.0 p2=52.0 p3=1.0 off=1.0 exp=5","config_hash":"b4799e6fd3d3fcc8b2d99c2b7a42b704cb39a2546454971eeb8594b78a1562e1","trades":133,"win_rate_pct":66.9172932330827,"profit_factor":1.2985792833405456,"net_profit_usd":40994.726000000024,"ev_per_trade_usd":308.23102255639117,"max_dd_pct":34.34514833467009,"sqn":1.4537892449342082,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
