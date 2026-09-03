from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='VOLATILITY_REGIME',fast=5,slow=8,p1=1.05,p2=0.7,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=25.0,tp=25.0,offset=2.25,expiry=3)
EXPECTED={"method":"VOLATILITY_REGIME f5/s8 p1=1.05 p2=0.7 p3=1.0 off=2.25 exp=3","config_hash":"a4f08f90968f132e7d67c32ae158a6bce2cdcbc10264aecd2e43e663fe8d0b23","trades":223,"win_rate_pct":65.47085201793722,"profit_factor":1.2816838549830847,"net_profit_usd":65934.65400000007,"ev_per_trade_usd":295.6710941704039,"max_dd_pct":37.181193367034425,"sqn":1.7220605011799661,"sl_pips":2500.0,"tp_pips":2500.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
