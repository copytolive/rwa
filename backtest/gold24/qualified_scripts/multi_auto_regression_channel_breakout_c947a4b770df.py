from common import Candidate, run_candidate
CANDIDATE=Candidate(symbol="GOLD",timeframe='D1',family='REGRESSION_CHANNEL_BREAKOUT',fast=34,slow=89,p1=0.01,p2=2.0,p3=1.0,entry_method='LIMIT',direction_mode='LONG_ONLY',sl=24.0,tp=24.0,offset=1.75,expiry=12)
EXPECTED={"method":"REGRESSION_CHANNEL_BREAKOUT f34/s89 p1=0.01 p2=2.0 p3=1.0 off=1.75 exp=12","config_hash":"c947a4b770dfbae4475a09554e7ba2191bd181807ffd678721f8d5c39c20612f","trades":219,"win_rate_pct":63.926940639269404,"profit_factor":1.1311025401445955,"net_profit_usd":31691.693000000007,"ev_per_trade_usd":144.7109269406393,"max_dd_pct":58.79980106517508,"sqn":0.860753416246398,"sl_pips":2400.0,"tp_pips":2400.0}
if __name__=="__main__": run_candidate(CANDIDATE,EXPECTED)
