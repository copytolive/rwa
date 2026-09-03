from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=7,slow=14,p1=1.5,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=25.0,offset=1.0,expiry=4)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f7/s14 p1=1.5 p2=40.0 p3=1.0 off=1.0 exp=4","config_hash":"657c7fe3b1612ed4e2e6a9cc5d5da05f6e8407b1cd064c6088175edb575bae2d","trades":172,"win_rate_pct":61.04651162790697,"profit_factor":1.2047472218385524,"net_profit_usd":39167.27500000004,"ev_per_trade_usd":227.7167151162793,"max_dd_pct":32.90172005134111,"sqn":1.166431982021188,"sl_pips":2350.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
