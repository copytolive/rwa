from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="VOLUME",fast=13,slow=144,p1=1.4,p2=55.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=24.0,tp=24.5,offset=4.75,expiry=8)
EXPECTED={"method":"VOLUME f13/s144 p1=1.4 p2=55.0 p3=1.0 off=4.75 exp=8","config_hash":"e0c3f07796453a518fb37bb614058e586c950bbe20c982963004528d7c412cb3","trades":108,"win_rate_pct":63.888888888888886,"profit_factor":1.3042772588957148,"net_profit_usd":35008.341000000066,"ev_per_trade_usd":324.1513055555562,"max_dd_pct":47.945233186166384,"sqn":1.2254643243613557,"sl_pips":2400,"tp_pips":2450}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
