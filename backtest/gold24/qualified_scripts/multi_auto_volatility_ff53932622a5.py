from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY',fast=5,slow=100,p1=1.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=24.5,offset=2.25,expiry=7)
EXPECTED={"method":"VOLATILITY f5/s100 p1=1.2 p2=55.0 p3=1.0 off=2.25 exp=7","config_hash":"ff53932622a511321dbccb1394479e917013059fd2528ea9b151671e104a86b5","trades":100,"win_rate_pct":67.0,"profit_factor":1.4480179022541482,"net_profit_usd":45185.350000000035,"ev_per_trade_usd":451.85350000000034,"max_dd_pct":30.736518838706207,"sqn":1.6462512973871317,"sl_pips":2400.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
