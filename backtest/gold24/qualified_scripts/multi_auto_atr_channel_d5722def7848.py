from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='ATR_CHANNEL',fast=10,slow=89,p1=1.8,p2=55.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=23.5,tp=24.0,offset=0.5,expiry=4)
EXPECTED={"method":"ATR_CHANNEL f10/s89 p1=1.8 p2=55.0 p3=1.0 off=0.5 exp=4","config_hash":"d5722def7848c3d7ed796ab330af0c9735744e0256d168cd130085dfbcd81cc1","trades":102,"win_rate_pct":65.68627450980392,"profit_factor":1.3057176410639215,"net_profit_usd":31798.871000000065,"ev_per_trade_usd":311.75363725490257,"max_dd_pct":32.228904692021146,"sqn":1.1799199404251366,"sl_pips":2350.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
