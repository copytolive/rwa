from common import Candidate, run_candidate

CANDIDATE = Candidate(
    symbol="GOLD", timeframe="D1", family="CANDLE_ENGULFING",
    fast=34, slow=144, p1=66.0, p2=58.0, p3=1.0,
    entry_method="LIMIT", direction_mode="LONG_ONLY",
    sl=23.5, tp=23.5, offset=2.75, expiry=8,
)

EXPECTED = {
    "method": "CANDLE_ENGULFING f34/s144 p1=66.0 p2=58.0 p3=1.0 off=2.75 exp=8",
    "config_hash": "7c00212eb6bd65ad07e432d4a261d3f3240478d4d4698cf57e99c549684b61cb",
    "trades": 148,
    "win_rate_pct": 65.54054054054055,
    "profit_factor": 1.2641504115793922,
    "net_profit_usd": 38273.57900000003,
    "ev_per_trade_usd": 258.6052635135137,
    "max_dd_pct": 44.68204235724034,
    "sqn": 1.3824758652323004,
    "sl_pips": 2350.0,
    "tp_pips": 2350.0,
}

if __name__ == "__main__":
    run_candidate(CANDIDATE, EXPECTED)
