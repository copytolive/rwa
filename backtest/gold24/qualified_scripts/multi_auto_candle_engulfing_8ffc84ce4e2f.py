from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CANDLE_ENGULFING',fast=50,slow=89,p1=58.0,p2=58.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=21.5,tp=23.5,offset=3.0,expiry=7)
EXPECTED={"method":"CANDLE_ENGULFING f50/s89 p1=58.0 p2=58.0 p3=1.0 off=3.0 exp=7","config_hash":"8ffc84ce4e2f10f23e2456f35a0a6a3ff0c5c04668586f6696c9ccc1a46f0ffb","trades":205,"win_rate_pct":59.51219512195122,"profit_factor":1.0932517837178184,"net_profit_usd":20288.542999999998,"ev_per_trade_usd":98.96850243902438,"max_dd_pct":95.72545731201635,"sqn":0.6106494669027154,"sl_pips":2150.0,"tp_pips":2350.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
