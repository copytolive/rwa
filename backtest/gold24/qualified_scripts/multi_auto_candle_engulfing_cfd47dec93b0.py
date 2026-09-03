from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CANDLE_ENGULFING',fast=26,slow=144,p1=55.0,p2=52.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=24.5,tp=22.5,offset=1.75,expiry=9)
EXPECTED={"method":"CANDLE_ENGULFING f26/s144 p1=55.0 p2=52.0 p3=1.0 off=1.75 exp=9","config_hash":"cfd47dec93b09e11ede41b3d31ecbc385e18755869271e3c160dfa1e1dbb7135","trades":213,"win_rate_pct":64.78873239436619,"profit_factor":1.1728467569845118,"net_profit_usd":38014.37799999999,"ev_per_trade_usd":178.4712582159624,"max_dd_pct":64.50080923458576,"sqn":1.0992315701944013,"sl_pips":2450.0,"tp_pips":2250.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
