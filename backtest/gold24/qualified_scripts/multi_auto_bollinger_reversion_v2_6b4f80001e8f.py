from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=8,slow=21,p1=1.5,p2=35.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=18.5,tp=21.5,offset=0.5,expiry=4)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f8/s21 p1=1.5 p2=35.0 p3=1.0 off=0.5 exp=4","config_hash":"6b4f80001e8f825f5a77651dbdb381f9dc1eda19d7a7b66193a22832d3e39751","trades":119,"win_rate_pct":60.50420168067227,"profit_factor":1.2115589884536575,"net_profit_usd":23779.287000000008,"ev_per_trade_usd":199.82594117647065,"max_dd_pct":52.638432965245485,"sqn":0.9703887865394684,"sl_pips":1850.0,"tp_pips":2150.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
