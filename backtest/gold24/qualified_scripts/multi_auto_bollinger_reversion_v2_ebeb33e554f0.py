from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='BOLLINGER_REVERSION_V2',fast=5,slow=21,p1=1.5,p2=40.0,p3=1.0,entry_method='STOP',direction_mode='LONG_ONLY',sl=23.5,tp=25.0,offset=1.0,expiry=12)
EXPECTED={"method":"BOLLINGER_REVERSION_V2 f5/s21 p1=1.5 p2=40.0 p3=1.0 off=1.0 exp=12","config_hash":"ebeb33e554f0360ce51bb9dbc6388a4fadd50fc52f57580a16e871e893ab8ba5","trades":115,"win_rate_pct":63.47826086956522,"profit_factor":1.2724493100729695,"net_profit_usd":32944.95500000001,"ev_per_trade_usd":286.4778695652175,"max_dd_pct":46.05747432567316,"sqn":1.2672012633269032,"sl_pips":2350.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
