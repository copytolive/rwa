from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="VOLUME",fast=50,slow=100,p1=1.4,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=25.0,tp=18.0,offset=1.0,expiry=5)
EXPECTED={"method":"VOLUME f50/s100 p1=1.4 p2=55.0 p3=1.0 off=1.0 exp=5","config_hash":"09fb362cbb4fcbc244e2c5e9d3ec336466e6b63f391328af656f24482c15290d","trades":114,"win_rate_pct":71.05263157894737,"profit_factor":1.2287013980538433,"net_profit_usd":22933.679000000036,"ev_per_trade_usd":201.17262280701786,"max_dd_pct":55.718995154469695,"sqn":0.9019685769259572,"sl_pips":2500.0,"tp_pips":1800.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
