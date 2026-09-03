from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=3,slow=100,p1=66.0,p2=58.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=25.0,tp=25.0,offset=1.5,expiry=7)
EXPECTED={"method":"DONCHIAN f3/s100 p1=66.0 p2=58.0 p3=1.0 off=1.5 exp=7","config_hash":"48d038ed63918bfcaf1c9ba625aa8580e7d83baa7419d87a2e57604714d96078","trades":122,"win_rate_pct":65.57377049180327,"profit_factor":1.2472878665580736,"net_profit_usd":32060.498,"ev_per_trade_usd":262.79096721311475,"max_dd_pct":38.38997058016772,"sqn":1.1809534359783118,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
