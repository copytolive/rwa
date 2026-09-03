from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIBONACCI',fast=10,slow=20,p1=0.786,p2=3.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=22.0,tp=25.0,offset=1.0,expiry=8)
EXPECTED={"method":"FIBONACCI f10/s20 p1=0.786 p2=3.0 p3=1.0 off=1.0 exp=8","config_hash":"349543cfa42db15be16fae6dcdb7b93a659037ec797aa7216f0647ae317cda38","trades":108,"win_rate_pct":60.18518518518518,"profit_factor":1.1741953907219596,"net_profit_usd":20007.082,"ev_per_trade_usd":185.25075925925924,"max_dd_pct":57.29127341951147,"sqn":0.8199073388030826,"sl_pips":2200.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
