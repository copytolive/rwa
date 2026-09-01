from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=34,slow=144,p1=62.0,p2=66.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=18.0,tp=21.0,offset=4.5,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f34/s144 p1=62.0 p2=66.0 p3=1.0 off=4.5 exp=8","config_hash":"aa50efa4bf3e91060ff7938d45928802aef1e02995bdfb98fa08ad43d12facb3","trades":202,"win_rate_pct":61.881188118811885,"profit_factor":1.2110741574718467,"net_profit_usd":37072.91600000002,"ev_per_trade_usd":183.52928712871298,"max_dd_pct":39.15138937717809,"sqn":1.2857701161559083,"sl_pips":1800.0,"tp_pips":2100.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
