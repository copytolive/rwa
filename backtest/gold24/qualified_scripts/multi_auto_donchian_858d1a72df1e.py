from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='DONCHIAN',fast=3,slow=89,p1=66.0,p2=52.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=16.5,tp=21.5,offset=2.25,expiry=7)
EXPECTED={"method":"DONCHIAN f3/s89 p1=66.0 p2=52.0 p3=1.0 off=2.25 exp=7","config_hash":"858d1a72df1e887393300307668dc955ac15db05a1f1ec3bfdb821f12312cd35","trades":136,"win_rate_pct":61.029411764705884,"profit_factor":1.2100901373054205,"net_profit_usd":24251.61550000002,"ev_per_trade_usd":178.32070220588253,"max_dd_pct":36.102462005261074,"sqn":1.085399945251705,"sl_pips":1650.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
