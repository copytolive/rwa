from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=34,slow=144,p1=58.0,p2=62.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=25.0,tp=25.0,offset=1.0,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f34/s144 p1=58.0 p2=62.0 p3=1.0 off=1.0 exp=8","config_hash":"f5ba0fe1ce860327d35c4e5862e13d5e0d82a0ff84cb308e90c51b9dfac8d69f","trades":204,"win_rate_pct":61.76470588235294,"profit_factor":1.13479264855617,"net_profit_usd":31502.060999999994,"ev_per_trade_usd":154.4218676470588,"max_dd_pct":58.5894872849395,"sqn":0.8662307589673527,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
