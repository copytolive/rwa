from __future__ import annotations

import math

import pandas as pd

FIXED_SL = 12.50
FIXED_TP = 25.00
RR = 2.0
MIN_TRADES_PER_WEEK = 2.0
MIN_PROFITABLE_WEEKS_PCT = 55.0
WR_RED_FLAG_PCT = 75.0

REQUIRED_LEDGER_COLUMNS = {
    "entry_time", "exit_time", "side", "pending_order", "entry_price", "exit_price",
    "fixed_sl", "fixed_tp", "quantity", "gross_pnl", "cost", "net_pnl", "exit_reason",
}


def _periods_utc(values: pd.Series) -> pd.Series:
    dt = pd.to_datetime(values, errors="coerce", utc=True)
    if dt.isna().any():
        raise ValueError("invalid UTC timestamp in ledger/data")
    return dt.dt.tz_convert(None).dt.to_period("W-SUN")


def continuous_calendar_weeks(data_dates: pd.Series) -> pd.PeriodIndex:
    p = _periods_utc(data_dates)
    if p.empty:
        raise ValueError("dataset has zero timestamps")
    return pd.period_range(start=p.iloc[0], end=p.iloc[-1], freq="W-SUN")


def longest_negative_week_streak(weekly_net: pd.Series) -> int:
    best = cur = 0
    for x in weekly_net.to_numpy(float):
        if x < 0:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return int(best)


def weekly_economics(data_dates: pd.Series, ledger: pd.DataFrame) -> dict:
    weeks = continuous_calendar_weeks(data_dates)
    weekly_net = pd.Series(0.0, index=weeks, dtype=float)
    weekly_trades = pd.Series(0, index=weeks, dtype=int)

    if ledger is None:
        ledger = pd.DataFrame()
    if not ledger.empty:
        missing = sorted(REQUIRED_LEDGER_COLUMNS.difference(ledger.columns))
        if missing:
            raise ValueError(f"ledger missing required columns: {missing}")
        exits = _periods_utc(ledger["exit_time"])
        pnl = pd.to_numeric(ledger["net_pnl"], errors="coerce")
        if pnl.isna().any():
            raise ValueError("ledger net_pnl contains NaN")
        grouped = pd.DataFrame({"week": exits, "net": pnl}).groupby("week", observed=False)["net"]
        weekly_net = weekly_net.add(grouped.sum(), fill_value=0.0).reindex(weeks, fill_value=0.0)
        weekly_trades = pd.Series(exits).value_counts().reindex(weeks, fill_value=0).astype(int)

    trades = int(len(ledger))
    history_weeks = int(len(weeks))
    net_total = float(weekly_net.sum())
    expectancy = net_total / trades if trades else 0.0
    trades_per_week = trades / history_weeks if history_weeks else 0.0
    avg_weekly = float(weekly_net.mean()) if history_weeks else 0.0
    median_weekly = float(weekly_net.median()) if history_weeks else 0.0
    profitable_weeks = int((weekly_net > 0).sum())
    profitable_weeks_pct = 100.0 * profitable_weeks / history_weeks if history_weeks else 0.0
    zero_trade_weeks = int((weekly_trades == 0).sum())
    losing_weeks = int((weekly_net < 0).sum())
    max_weekly_loss = float(weekly_net.min()) if history_weeks else 0.0

    if trades:
        pnl = pd.to_numeric(ledger["net_pnl"], errors="raise").to_numpy(float)
        wr = 100.0 * float((pnl > 0).sum()) / trades
        gp = float(pnl[pnl > 0].sum())
        gl = float(-pnl[pnl <= 0].sum())
        pf = gp / gl if gl > 0 else float("inf")
    else:
        wr, pf = 0.0, 0.0

    dates = pd.to_datetime(data_dates, errors="raise", utc=True)
    years = list(range(int(dates.iloc[0].year), int(dates.iloc[-1].year) + 1))
    annual = pd.Series(0.0, index=years, dtype=float)
    if trades:
        exit_year = pd.to_datetime(ledger["exit_time"], errors="raise", utc=True).dt.year
        annual_trades = pd.DataFrame({"year": exit_year, "net": pd.to_numeric(ledger["net_pnl"], errors="raise")})
        annual = annual.add(annual_trades.groupby("year")["net"].sum(), fill_value=0.0).reindex(years, fill_value=0.0)
    profitable_years_pct = 100.0 * float((annual > 0).sum()) / len(years) if years else 0.0

    min_trades_required = int(math.ceil(MIN_TRADES_PER_WEEK * history_weeks))
    economic_gate_pass = bool(
        trades >= min_trades_required
        and trades_per_week >= MIN_TRADES_PER_WEEK
        and expectancy > 0
        and avg_weekly > 0
        and median_weekly > 0
        and profitable_weeks_pct >= MIN_PROFITABLE_WEEKS_PCT
    )
    wr_red_flag = bool(wr > WR_RED_FLAG_PCT)

    return {
        "history_weeks": history_weeks,
        "min_trades_required": min_trades_required,
        "trades": trades,
        "trades_per_week": float(trades_per_week),
        "net_profit": net_total,
        "net_expectancy": float(expectancy),
        "average_weekly_net": avg_weekly,
        "median_weekly_net": median_weekly,
        "profitable_weeks": profitable_weeks,
        "profitable_weeks_pct": float(profitable_weeks_pct),
        "zero_trade_weeks": zero_trade_weeks,
        "losing_weeks": losing_weeks,
        "max_weekly_loss": max_weekly_loss,
        "max_consecutive_losing_weeks": longest_negative_week_streak(weekly_net),
        "profitable_years_pct": float(profitable_years_pct),
        "win_rate_pct": float(wr),
        "win_rate_red_flag": wr_red_flag,
        "profit_factor_net": float(pf),
        "economic_gate_pass": economic_gate_pass,
        "weekly_goal_candidate_pass": bool(economic_gate_pass and not wr_red_flag),
    }


def selftest() -> None:
    dates = pd.Series(pd.date_range("2026-01-05", periods=64, freq="D", tz="UTC"))
    weeks = continuous_calendar_weeks(dates)
    assert len(weeks) == 10, len(weeks)

    rows = []
    for i, week in enumerate(weeks):
        per_trade = 2.0 if i < 6 else -1.0
        exit_ts = week.start_time.tz_localize("UTC") + pd.Timedelta(days=2, hours=12)
        for j in range(2):
            rows.append({
                "entry_time": str(exit_ts - pd.Timedelta(hours=4 + j)),
                "exit_time": str(exit_ts + pd.Timedelta(minutes=j)),
                "side": "LONG",
                "pending_order": "buy_stop",
                "entry_price": 2000.0,
                "exit_price": 2025.0 if per_trade > 0 else 1987.5,
                "fixed_sl": FIXED_SL,
                "fixed_tp": FIXED_TP,
                "quantity": 1.0,
                "gross_pnl": per_trade + 1.0,
                "cost": 1.0,
                "net_pnl": per_trade,
                "exit_reason": "TP" if per_trade > 0 else "SL",
            })
    m = weekly_economics(dates, pd.DataFrame(rows))
    assert m["trades"] == 20
    assert abs(m["trades_per_week"] - 2.0) < 1e-12
    assert abs(m["profitable_weeks_pct"] - 60.0) < 1e-12
    assert m["average_weekly_net"] > 0
    assert m["median_weekly_net"] > 0
    assert m["net_expectancy"] > 0
    assert m["weekly_goal_candidate_pass"] is True

    m2 = weekly_economics(dates, pd.DataFrame(rows[:-2]))
    assert m2["history_weeks"] == 10
    assert m2["zero_trade_weeks"] == 1
    assert m2["trades_per_week"] == 1.8
    assert m2["weekly_goal_candidate_pass"] is False
    print("weekly_metrics selftest: PASS")


if __name__ == "__main__":
    selftest()
