from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe="D1",family="VOLATILITY_REGIME",fast=5,slow=7,p1=1.1,p2=0.8,p3=1.0,entry_method="LIMIT",direction_mode="LONG_ONLY",sl=22.0,tp=25.0,offset=0.5,expiry=2)
EXPECTED={"method":"VOLATILITY_REGIME f5/s7 p1=1.1 p2=0.8 p3=1.0 off=0.5 exp=2","config_hash":"aa120bcd581bc34cb29382a46a1a39b51ccf83476f639c4cf178926701577dd3","trades":124,"win_rate_pct":58.87096774193548,"profit_factor":1.1645538279989995,"net_profit_usd":22555.461000000032,"ev_per_trade_usd":181.89887903225832,"max_dd_pct":71.35635277688101,"sqn":0.7719522984303292,"sl_pips":2200,"tp_pips":2500}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
