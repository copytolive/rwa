from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='SUPPORT_RESISTANCE',fast=3,slow=34,p1=1.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.5,tp=24.5,offset=0.75,expiry=6)
EXPECTED={"method":"SUPPORT_RESISTANCE f3/s34 p1=1.0 p2=55.0 p3=1.0 off=0.75 exp=6","config_hash":"6b892b882269e2aaa2becad843d2fd78d915f1dffa0835a917b1dfce81b0e530","trades":127,"win_rate_pct":67.71653543307086,"profit_factor":1.4594848527788449,"net_profit_usd":55750.30299999997,"ev_per_trade_usd":438.97876377952736,"max_dd_pct":23.164098358103306,"sqn":2.0875943732893325,"sl_pips":2450.0,"tp_pips":2450.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
