from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='PRICE_STRUCTURE',fast=13,slow=89,p1=52.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=23.5,tp=23.5,offset=5.0,expiry=11)
EXPECTED={"method":"PRICE_STRUCTURE f13/s89 p1=52.0 p2=55.0 p3=1.0 off=5.0 exp=11","config_hash":"7fa716f490efb827027c5c4c0772f5fc1ea5e2a9ce9f9475eb03c6efc1514c4f","trades":173,"win_rate_pct":63.005780346820806,"profit_factor":1.1384814639204073,"net_profit_usd":26316.35200000005,"ev_per_trade_usd":152.1176416184974,"max_dd_pct":42.38471230276301,"sqn":0.7730438162679011,"sl_pips":2350.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
