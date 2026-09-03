from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=13,p1=1.5,p2=35.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=25.0,offset=2.25,expiry=11)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s13 p1=1.5 p2=35.0 p3=1.0 off=2.25 exp=11","config_hash":"12b76bdad4601e58408de5831b22898ea30e80fc1c5d30d4715b64163ecebbb1","trades":153,"win_rate_pct":62.091503267973856,"profit_factor":1.197820711661112,"net_profit_usd":33591.43100000003,"ev_per_trade_usd":219.5518366013074,"max_dd_pct":37.05670871780299,"sqn":1.088737317308386,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
