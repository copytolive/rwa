from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=21,slow=144,p1=66.0,p2=62.0,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=18.0,tp=25.0,offset=5.0,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f21/s144 p1=66.0 p2=62.0 p3=1.0 off=5.0 exp=8","config_hash":"c8598fa098e7c37d0e0c8cd5d6408eff10d2cca5f54c9c5b1c56c8fe6c909291","trades":138,"win_rate_pct":59.42028985507246,"profit_factor":1.282774102081588,"net_profit_usd":36574.42200000003,"ev_per_trade_usd":265.0320434782611,"max_dd_pct":30.8667459569011,"sqn":1.4448837071668819,"sl_pips":1800,"tp_pips":2500}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
