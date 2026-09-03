from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="VOLATILITY_REGIME",fast=5,slow=13,p1=1.2,p2=0.8,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=23.5,tp=24.0,offset=2.25,expiry=10)
EXPECTED={"method":"VOLATILITY_REGIME f5/s13 p1=1.2 p2=0.8 p3=1.0 off=2.25 exp=10","config_hash":"1d77941a57cf39eb393cb22ecf54207970e49fc4075ad95093e5a7188dbfd587","trades":121,"win_rate_pct":63.63636363636363,"profit_factor":1.248718856317866,"net_profit_usd":31724.017000000065,"ev_per_trade_usd":262.1819586776865,"max_dd_pct":50.006905256175806,"sqn":1.0922407865294606,"sl_pips":2350,"tp_pips":2400}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
