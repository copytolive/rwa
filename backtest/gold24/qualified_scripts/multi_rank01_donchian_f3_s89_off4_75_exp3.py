from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="DONCHIAN",fast=3,slow=89,p1=58.0,p2=52.0,p3=1.0,entry_method="LIMIT",direction_mode="BOTH",sl=24.0,tp=24.0,offset=4.75,expiry=3)
EXPECTED={"method":"DONCHIAN f3/s89 p1=58.0 p2=52.0 p3=1.0 off=4.75 exp=3","config_hash":"8398c92b8fb894fd605c077b07863777b0e43160ea761f0dee51a40984efa5ef","trades":115,"win_rate_pct":68.69565217391305,"profit_factor":1.4329801731951763,"net_profit_usd":45356.686500000054,"ev_per_trade_usd":394.40596956521784,"max_dd_pct":57.2634,"sqn":1.8680517594362454,"sl_pips":2400.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
