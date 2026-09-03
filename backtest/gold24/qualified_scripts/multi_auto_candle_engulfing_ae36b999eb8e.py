from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CANDLE_ENGULFING',fast=21,slow=144,p1=66.0,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=3.75,expiry=11)
EXPECTED={"method":"CANDLE_ENGULFING f21/s144 p1=66.0 p2=55.0 p3=1.0 off=3.75 exp=11","config_hash":"ae36b999eb8e29ee9caf6ea8735c52033884e9ea504b0151368aa28173115166","trades":143,"win_rate_pct":63.63636363636363,"profit_factor":1.1921652676694359,"net_profit_usd":29998.548000000006,"ev_per_trade_usd":209.780055944056,"max_dd_pct":40.91227259425311,"sqn":1.0214173981276846,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
