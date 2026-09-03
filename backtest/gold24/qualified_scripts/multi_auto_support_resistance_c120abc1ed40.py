from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=26,p1=1.0,p2=55.0,p3=1.0,entry_method='STOP',direction_mode='LONG_ONLY',sl=23.5,tp=24.0,offset=1.75,expiry=8)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s26 p1=1.0 p2=55.0 p3=1.0 off=1.75 exp=8","config_hash":"c120abc1ed40e711821b0e7f7b208b4afc4aba88ec0f3c1915d80254254ae1de","trades":150,"win_rate_pct":62.0,"profit_factor":1.130115073094288,"net_profit_usd":20986.19299999999,"ev_per_trade_usd":139.90795333333327,"max_dd_pct":57.445432592428936,"sqn":0.7305201080832916,"sl_pips":2350.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
