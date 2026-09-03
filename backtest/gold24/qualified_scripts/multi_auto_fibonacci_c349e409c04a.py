from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='FIBONACCI',fast=8,slow=14,p1=0.786,p2=3.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=25.0,offset=1.75,expiry=10)
EXPECTED={"method":"FIBONACCI f8/s14 p1=0.786 p2=3.0 p3=1.0 off=1.75 exp=10","config_hash":"c349e409c04ad67455af7432a360e0ae79cc247f9bf650cea88b2e980a720743","trades":116,"win_rate_pct":62.93103448275862,"profit_factor":1.1863705256443977,"net_profit_usd":23537.17649999995,"ev_per_trade_usd":202.9066939655168,"max_dd_pct":51.24734060331806,"sqn":0.8955643864184535,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
