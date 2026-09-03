from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=3,slow=13,p1=1.2,p2=0.8,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=15.0,offset=2.0,expiry=4)
EXPECTED={"method":"VOLATILITY_REGIME f3/s13 p1=1.2 p2=0.8 p3=1.0 off=2.0 exp=4","config_hash":"488594394e81159e3039ac1b9a8b39049c5db51f392f3ba324a60668c6d38b4f","trades":226,"win_rate_pct":74.77876106194691,"profit_factor":1.1317517886210797,"net_profit_usd":21966.9910000001,"ev_per_trade_usd":97.19907522123938,"max_dd_pct":46.9283607837648,"sqn":0.7390633808318904,"sl_pips":2400.0,"tp_pips":1500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
