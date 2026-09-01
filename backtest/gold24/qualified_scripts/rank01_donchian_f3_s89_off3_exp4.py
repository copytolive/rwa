from common import Candidate, run_candidate

CANDIDATE = Candidate(
    symbol="GOLD", timeframe="D1", family="DONCHIAN",
    fast=3, slow=89, p1=66.0, p2=55.0, p3=1.0,
    entry_method="LIMIT", direction_mode="BOTH",
    sl=23.0, tp=23.5, offset=3.0, expiry=4,
)

EXPECTED = {
    "method": "DONCHIAN f3/s89 p1=66.0 p2=55.0 p3=1.0 off=3.0 exp=4",
    "config_hash": "13f689142dff69d33b2c6b33c3652aec484046d059d64636e4639f2d4a5bd295",
    "trades": 127,
    "win_rate_pct": 67.71653543307086,
    "profit_factor": 1.37233128481679,
    "net_profit_usd": 43692.940000000024,
    "ev_per_trade_usd": 344.03889763779546,
    "max_dd_pct": 34.70000125069698,
    "sqn": 1.7267246203918705,
    "sl_pips": 2300.0,
    "tp_pips": 2350.0,
}

if __name__ == "__main__":
    run_candidate(CANDIDATE, EXPECTED)
