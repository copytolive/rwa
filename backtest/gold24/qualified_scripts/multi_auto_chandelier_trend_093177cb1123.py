from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='CHANDELIER_TREND',fast=10,slow=144,p1=1.5,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=4.0,expiry=8)
EXPECTED={"method":"CHANDELIER_TREND f10/s144 p1=1.5 p2=55.0 p3=1.0 off=4.0 exp=8","config_hash":"093177cb1123d5b3caf89cad2b213c2d1d4b5898e561b831629d8c746c849fb7","trades":275,"win_rate_pct":61.81818181818182,"profit_factor":1.1363203683431342,"net_profit_usd":44863.875,"ev_per_trade_usd":163.14136363636365,"max_dd_pct":39.32590402342954,"sqn":0.9033021411480658,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
