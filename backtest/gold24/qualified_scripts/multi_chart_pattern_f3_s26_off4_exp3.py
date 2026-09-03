from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CHART_PATTERN",fast=3,slow=26,p1=0.7,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=19.5,tp=25.0,offset=4.0,expiry=3)
EXPECTED={"method":"CHART_PATTERN f3/s26 p1=0.7 p2=55.0 p3=1.0 off=4.0 exp=3","config_hash":"22929b50777d39e2cd417bc7c46a4d9b9ac48c58712a24754172ca0697a83931","trades":122,"win_rate_pct":62.295081967213115,"profit_factor":1.394382170429821,"net_profit_usd":44597.74899999999,"ev_per_trade_usd":365.5553196721311,"max_dd_pct":25.257465549171247,"sqn":1.8120043630093652,"sl_pips":1950,"tp_pips":2500}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
