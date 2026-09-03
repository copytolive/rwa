from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=8,slow=21,p1=2.0,p2=40.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=17.0,tp=20.0,offset=2.25,expiry=6)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f8/s21 p1=2.0 p2=40.0 p3=1.0 off=2.25 exp=6","config_hash":"6c50adf7ead2752fbe74fa2d374ac47db3aaa6168273222c9ce93d14cadec6bf","trades":101,"win_rate_pct":63.366336633663366,"profit_factor":1.3307716857805214,"net_profit_usd":27146.68000000004,"ev_per_trade_usd":268.7790099009905,"max_dd_pct":25.773925617495014,"sqn":1.3960736095925201,"sl_pips":1700.0,"tp_pips":2000.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
