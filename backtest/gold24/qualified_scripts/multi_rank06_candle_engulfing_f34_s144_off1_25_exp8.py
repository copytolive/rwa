from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="CANDLE_ENGULFING",fast=34,slow=144,p1=66.0,p2=58.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=21.0,tp=25.0,offset=1.25,expiry=8)
EXPECTED={"method":"CANDLE_ENGULFING f34/s144 p1=66.0 p2=58.0 p3=1.0 off=1.25 exp=8","config_hash":"c7bf875486d7ce6dcbd638821f2932d6dac402aa6979023e79360e01f6ddfab5","trades":212,"win_rate_pct":58.490566037735846,"profit_factor":1.1498003858921249,"net_profit_usd":34096.8785,"ev_per_trade_usd":160.8343325471698,"max_dd_pct":64.88296361811668,"sqn":0.9824369147724634,"sl_pips":2100.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
