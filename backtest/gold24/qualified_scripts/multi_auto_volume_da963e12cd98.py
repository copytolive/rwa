from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLUME',fast=55,slow=144,p1=1.2,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=25.0,offset=1.75,expiry=7)
EXPECTED={"method":"VOLUME f55/s144 p1=1.2 p2=55.0 p3=1.0 off=1.75 exp=7","config_hash":"da963e12cd98d9e31885db06c211ae824bf34ae85962585f68aa89027c531d4c","trades":111,"win_rate_pct":64.86486486486487,"profit_factor":1.3442764735819157,"net_profit_usd":40573.73500000002,"ev_per_trade_usd":365.52914414414437,"max_dd_pct":41.09073384165506,"sqn":1.4003604329373693,"sl_pips":2400.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
