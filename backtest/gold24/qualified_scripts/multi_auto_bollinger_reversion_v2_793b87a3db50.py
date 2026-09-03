from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=13,p1=1.5,p2=25.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=15.5,tp=21.5,offset=1.0,expiry=7)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s13 p1=1.5 p2=25.0 p3=1.0 off=1.0 exp=7","config_hash":"793b87a3db50513e00f1d249f87abcdd72966d1c0e1e48437dd1c805a02d4a49","trades":117,"win_rate_pct":57.26495726495727,"profit_factor":1.196580669846298,"net_profit_usd":20178.64700000002,"ev_per_trade_usd":172.46706837606854,"max_dd_pct":36.14530516772211,"sqn":0.9463987741253187,"sl_pips":1550.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
