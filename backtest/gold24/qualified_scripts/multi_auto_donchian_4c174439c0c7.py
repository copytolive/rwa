from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=3,slow=100,p1=62.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=22.5,tp=25.0,offset=0.75,expiry=11)
EXPECTED={"method":"DONCHIAN f3/s100 p1=62.0 p2=55.0 p3=1.0 off=0.75 exp=11","config_hash":"4c174439c0c7ea5631baf671697362f6a11dfa6db5cfe0e16d45ead3f4030e05","trades":123,"win_rate_pct":62.60162601626016,"profit_factor":1.1991896565146911,"net_profit_usd":25887.563000000006,"ev_per_trade_usd":210.46799186991873,"max_dd_pct":42.46893420078355,"sqn":0.9813667817387304,"sl_pips":2250.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
