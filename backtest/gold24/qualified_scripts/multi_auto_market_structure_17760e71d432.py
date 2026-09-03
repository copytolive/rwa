from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='MARKET_STRUCTURE',fast=13,slow=144,p1=66.0,p2=62.0,p3=1.0,entry_method='LIMIT',direction_mode='BOTH',sl=25.0,tp=25.0,offset=1.5,expiry=4)
EXPECTED={"method":"MARKET_STRUCTURE f13/s144 p1=66.0 p2=62.0 p3=1.0 off=1.5 exp=4","config_hash":"17760e71d4327ee8d29d669f9337715dcec71a2dd9a2399b31750aac4d87a35e","trades":138,"win_rate_pct":63.768115942028984,"profit_factor":1.23600495964189,"net_profit_usd":35892.09400000003,"ev_per_trade_usd":260.0876376811596,"max_dd_pct":43.330366629770374,"sqn":1.1283513315506943,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
