from common import Candidate, run_candidate

CANDIDATE = Candidate(
    symbol="GOLD", timeframe="D1", family="DONCHIAN",
    fast=3, slow=100, p1=55.0, p2=58.0, p3=1.0,
    entry_method="LIMIT", direction_mode="BOTH",
    sl=22.0, tp=23.0, offset=1.0, expiry=7,
)

EXPECTED = {
    "method": "DONCHIAN f3/s100 p1=55.0 p2=58.0 p3=1.0 off=1.0 exp=7",
    "config_hash": "860c7a7defb867ad594b594e41f4a5157b3dc4262a1b1bd69c978298130ac57c",
    "trades": 126,
    "win_rate_pct": 65.07936507936508,
    "profit_factor": 1.2249578259285974,
    "net_profit_usd": 27572.409,
    "ev_per_trade_usd": 218.82864285714285,
    "max_dd_pct": 41.484508709379774,
    "sqn": 1.0999765389846419,
    "sl_pips": 2200.0,
    "tp_pips": 2300.0,
}

if __name__ == "__main__":
    run_candidate(CANDIDATE, EXPECTED)
