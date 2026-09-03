from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHART_PATTERN',fast=5,slow=10,p1=0.5,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=21.5,tp=21.5,offset=2.0,expiry=3)
EXPECTED={"method":"CHART_PATTERN f5/s10 p1=0.5 p2=55.0 p3=1.0 off=2.0 exp=3","config_hash":"9d86284ed4adfc90e529ced3529d332621682df137ba3f2c0931868ea35a98bd","trades":110,"win_rate_pct":67.27272727272727,"profit_factor":1.2879041443088632,"net_profit_usd":28060.051999999992,"ev_per_trade_usd":255.09138181818176,"max_dd_pct":35.92962722078516,"sqn":1.2783787228651473,"sl_pips":2150.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
