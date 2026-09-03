from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ROLLING_ZSCORE',fast=34,slow=89,p1=2.1,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.5,tp=19.0,offset=2.0,expiry=7)
EXPECTED={"method":"ROLLING_ZSCORE f34/s89 p1=2.1 p2=55.0 p3=1.0 off=2.0 exp=7","config_hash":"a575437508de07e6c36ad1c3644953c8a40eab6eaa277e3b0206dc9b4ce4aeda","trades":106,"win_rate_pct":73.58490566037736,"profit_factor":1.4005313661365921,"net_profit_usd":32198.17099999999,"ev_per_trade_usd":303.75633018867916,"max_dd_pct":38.88183142997268,"sqn":1.6191282837923149,"sl_pips":2250.0,"tp_pips":1900.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
