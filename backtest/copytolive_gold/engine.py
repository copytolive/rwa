from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

DEPOSIT = 10_000.0
RISK = 200.0
FEE = 0.0016
CORR_LIMIT = 0.50

GATE_MIN_TRADES = 300
GATE_MIN_NET_PROFIT = 20_000.0
GATE_MIN_PF = 1.20
GATE_MAX_DD_PCT = 25.0
GATE_MIN_OOS_PF = 1.0
GATE_MIN_POSITIVE_YEAR_PCT = 60.0
GATE_MIN_MC_PROFIT_PROB_PCT = 95.0
GATE_MAX_MC95_DD_PCT = 25.0


@dataclass
class Replay:
    strategy_id: str
    snapshot: dict[str, Any]
    trades: list[dict[str, Any]]
    bar_pnl: np.ndarray
    metrics: dict[str, Any]
    train: dict[str, Any]
    test: dict[str, Any]
    positive_year_pct: float
    worst_year: str
    period: str
    history_years: float
    mc_profit_probability_pct: float
    mc95_dd_pct: float
    mc_pass: bool
    base_gate: bool
    raw_corr_max: float = 0.0
    corr_max: float | None = None
    corr_gate: str = "PENDING"
    strict_gate: bool = False
    parity: dict[str, Any] | None = None


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_snapshot(path: Path) -> dict[str, Any]:
    obj = json.loads(path.read_text())
    if obj.get("schema") != "copytolive.gold.active.v1":
        raise RuntimeError("unsupported CopyToLive snapshot schema")
    strategies = obj.get("strategies") or []
    if len(strategies) != 118:
        raise RuntimeError(f"snapshot must contain exactly 118 active GOLD strategies, got {len(strategies)}")
    ids = [str(x.get("id")) for x in strategies]
    if len(set(ids)) != 118:
        raise RuntimeError("snapshot contains duplicate strategy ids")
    for x in strategies:
        if str(x.get("symbol") or x.get("_sym")).upper() != "GOLD":
            raise RuntimeError(f"non-GOLD strategy in snapshot: {x.get('id')}")
        if str(x.get("timeframe")).upper() != "H1":
            raise RuntimeError(f"non-H1 active strategy in snapshot: {x.get('id')}")
        script = x.get("script") or {}
        raw = base64.b64decode(script.get("content_b64") or "")
        if hashlib.sha256(raw).hexdigest() != script.get("sha256"):
            raise RuntimeError(f"script checksum mismatch: {x.get('id')}")
    return obj


def load_ohlcv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise RuntimeError(f"OHLCV file not found: {path}")
    if path.suffix.lower() in {".parquet", ".pq"}:
        df = pd.read_parquet(path)
    else:
        df = pd.read_csv(path)

    ren = {}
    for col in df.columns:
        lo = str(col).lower()
        if lo in {"date", "datetime", "timestamp", "time"}:
            ren[col] = "Date"
        elif lo in {"open", "high", "low", "close", "volume"}:
            ren[col] = lo
    df = df.rename(columns=ren)

    required = ["Date", "open", "high", "low", "close"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise RuntimeError(f"OHLCV missing columns: {missing}")
    if "volume" not in df.columns:
        df["volume"] = 0.0

    if pd.api.types.is_numeric_dtype(df["Date"]):
        dt = pd.to_datetime(df["Date"], unit="ms", utc=True, errors="coerce")
    else:
        dt = pd.to_datetime(df["Date"], utc=True, errors="coerce")
    if dt.isna().any():
        raise RuntimeError("OHLCV contains invalid timestamps")

    out = pd.DataFrame(index=pd.DatetimeIndex(dt))
    for c in ["open", "high", "low", "close", "volume"]:
        out[c] = pd.to_numeric(df[c], errors="coerce").to_numpy()
    out = out.dropna(subset=["open", "high", "low", "close"])
    out = out[~out.index.duplicated(keep="last")].sort_index()
    if len(out) < 10_000:
        raise RuntimeError(f"H1 dataset unexpectedly short: {len(out)} rows")

    o = out["open"].to_numpy(float)
    h = out["high"].to_numpy(float)
    l = out["low"].to_numpy(float)
    c = out["close"].to_numpy(float)
    if np.any(h < l) or np.any(o < l) or np.any(o > h) or np.any(c < l) or np.any(c > h):
        raise RuntimeError("OHLC consistency violation")
    return out


def compile_strategy(strategy: dict[str, Any]):
    script = strategy["script"]
    raw = base64.b64decode(script["content_b64"])
    if hashlib.sha256(raw).hexdigest() != script["sha256"]:
        raise RuntimeError(f"script SHA mismatch for {strategy['id']}")
    ns: dict[str, Any] = {"__name__": f"copytolive_snapshot_{strategy['id']}"}
    exec(compile(raw.decode("utf-8"), script["path"], "exec"), ns, ns)
    run = ns.get("run")
    if not callable(run):
        raise RuntimeError(f"strategy has no callable run(): {strategy['id']}")
    for k in ("SL_PCT", "TP_RATIO", "RISK", "DEPOSIT"):
        if k not in ns:
            raise RuntimeError(f"strategy missing {k}: {strategy['id']}")
    return run, ns


def run_signal(strategy: dict[str, Any], df: pd.DataFrame) -> tuple[np.ndarray, dict[str, Any]]:
    run, ns = compile_strategy(strategy)
    close = df["close"].to_numpy(np.float64)
    high = df["high"].to_numpy(np.float64)
    low = df["low"].to_numpy(np.float64)
    sig = np.asarray(run(close, high, low), dtype=np.int8)
    if len(sig) != len(df):
        raise RuntimeError(f"signal length mismatch for {strategy['id']}: {len(sig)} != {len(df)}")
    if not np.isin(sig, [-1, 0, 1]).all():
        raise RuntimeError(f"invalid signal values for {strategy['id']}")
    contract = {
        "sl_pct": float(ns["SL_PCT"]),
        "tp_ratio": float(ns["TP_RATIO"]),
        "risk_usd": float(ns["RISK"]),
        "deposit_usd": float(ns["DEPOSIT"]),
        "fast": int(ns.get("FAST", 0)),
        "slow": int(ns.get("SLOW", 0)),
        "signal_type": str(ns.get("SIGNAL_TYPE", strategy.get("signalType", ""))),
    }
    if not math.isclose(contract["risk_usd"], RISK, rel_tol=0, abs_tol=1e-12):
        raise RuntimeError(f"unexpected risk contract for {strategy['id']}: {contract['risk_usd']}")
    if not math.isclose(contract["deposit_usd"], DEPOSIT, rel_tol=0, abs_tol=1e-12):
        raise RuntimeError(f"unexpected deposit contract for {strategy['id']}: {contract['deposit_usd']}")
    return sig, contract


def bt_copytolive(
    sigs: np.ndarray,
    df: pd.DataFrame,
    sl_pct: float,
    tp_ratio: float,
    fee: float = FEE,
    risk: float = RISK,
) -> tuple[list[dict[str, Any]], np.ndarray]:
    """CopyToLive wf_common.bt semantics: close entry, %SL, TP multiple, risk sizing."""
    c = df["close"].to_numpy(float)
    h = df["high"].to_numpy(float)
    l = df["low"].to_numpy(float)
    idx = df.index
    trades: list[dict[str, Any]] = []
    bar_pnl = np.zeros(len(df), dtype=float)
    pos = None
    eq = float(DEPOSIT)

    for i in range(len(c)):
        if pos is None:
            if sigs[i] != 0:
                ep = float(c[i])
                sl = ep * float(sl_pct)
                tp = sl * float(tp_ratio)
                if sl <= 0:
                    continue
                lot = float(risk) / sl
                pos = (int(sigs[i]), ep, sl, tp, lot, i)
        else:
            direction, ep, sl, tp, lot, entry_i = pos
            fe = float(fee) * ep * lot
            pnl = None
            exit_type = ""
            xp = None
            if direction == 1:
                if l[i] <= ep - sl:
                    pnl = -sl * lot - fe
                    xp = ep - sl
                    exit_type = "SL"
                elif h[i] >= ep + tp:
                    pnl = tp * lot - fe
                    xp = ep + tp
                    exit_type = "TP"
            else:
                if h[i] >= ep + sl:
                    pnl = -sl * lot - fe
                    xp = ep + sl
                    exit_type = "SL"
                elif l[i] <= ep - tp:
                    pnl = tp * lot - fe
                    xp = ep - tp
                    exit_type = "TP"

            if pnl is not None:
                eq += pnl
                bar_pnl[i] += pnl
                trades.append({
                    "openTime": str(idx[entry_i])[:19],
                    "closeTime": str(idx[i])[:19],
                    "type": "BUY" if direction == 1 else "SELL",
                    "openPrice": round(ep, 8),
                    "closePrice": round(float(xp), 8),
                    "lots": round(float(lot), 8),
                    "profit": round(float(pnl), 8),
                    "balance": round(float(eq), 8),
                    "exitType": exit_type,
                    "open_index": int(entry_i),
                    "close_index": int(i),
                })
                pos = None
    return trades, bar_pnl


def metrics_from_trades(trades: list[dict[str, Any]]) -> dict[str, Any]:
    if not trades:
        return {
            "totalTrades": 0, "winRate": 0.0, "profitFactor": 0.0,
            "maxDrawdown": 0.0, "maxDrawdownValue": 0.0, "netProfit": 0.0,
            "expectancy": 0.0, "sqn": 0.0, "recoveryFactor": 0.0,
            "avgProfit": 0.0, "avgLoss": 0.0, "maxConsecLoss": 0,
            "longsTotal": 0, "shortsTotal": 0,
        }
    pnl = np.asarray([float(t["profit"]) for t in trades], dtype=float)
    wins = pnl[pnl > 0]
    losses = pnl[pnl <= 0]
    gp = float(wins.sum())
    gl = abs(float(losses.sum()))
    net = float(pnl.sum())
    n = len(pnl)
    wr = 100.0 * len(wins) / n
    pf = gp / gl if gl > 0 else float("inf")

    equity = DEPOSIT + np.cumsum(pnl)
    peak = np.maximum.accumulate(np.r_[DEPOSIT, equity])[1:]
    dd_abs = peak - equity
    dd_pct = np.where(peak > 0, dd_abs / peak * 100.0, 0.0)
    max_dd_abs = float(dd_abs.max(initial=0.0))
    max_dd_pct = float(dd_pct.max(initial=0.0))
    exp = net / n

    std = float(np.std(pnl))
    sqn = float(np.mean(pnl) / std * math.sqrt(n)) if std > 0 else 0.0
    recovery = net / max_dd_abs if max_dd_abs > 0 else 0.0
    avg_profit = float(wins.mean()) if len(wins) else 0.0
    avg_loss = abs(float(losses.mean())) if len(losses) else 0.0

    cur_loss = max_loss = 0
    for p in pnl:
        if p <= 0:
            cur_loss += 1
            max_loss = max(max_loss, cur_loss)
        else:
            cur_loss = 0

    return {
        "totalTrades": int(n),
        "winningTrades": int(len(wins)),
        "losingTrades": int(len(losses)),
        "winRate": float(wr),
        "profitFactor": float(pf),
        "maxDrawdown": float(max_dd_pct),
        "maxDrawdownValue": float(max_dd_abs),
        "netProfit": float(net),
        "expectancy": float(exp),
        "sqn": float(sqn),
        "recoveryFactor": float(recovery),
        "grossProfit": gp,
        "grossLoss": gl,
        "avgProfit": avg_profit,
        "avgLoss": avg_loss,
        "maxConsecLoss": int(max_loss),
        "longsTotal": int(sum(t["type"] == "BUY" for t in trades)),
        "shortsTotal": int(sum(t["type"] == "SELL" for t in trades)),
    }


def _as_utc_timestamp(text: str) -> pd.Timestamp:
    ts = pd.Timestamp(text)
    return ts.tz_localize("UTC") if ts.tzinfo is None else ts.tz_convert("UTC")


def walk_forward(trades: list[dict[str, Any]], df: pd.DataFrame, train_pct: float = 0.70):
    if not trades:
        return metrics_from_trades([]), metrics_from_trades([])
    split_idx = min(max(int(len(df) * train_pct), 1), len(df) - 1)
    split_ts = df.index[split_idx]
    train = [t for t in trades if _as_utc_timestamp(t["closeTime"]) <= split_ts]
    test = [t for t in trades if _as_utc_timestamp(t["closeTime"]) > split_ts]
    return metrics_from_trades(train), metrics_from_trades(test)


def yearly_stats(trades: list[dict[str, Any]], df: pd.DataFrame):
    years = list(range(int(df.index[0].year), int(df.index[-1].year) + 1))
    if not years:
        return 0.0, "N/A", "N/A", 0.0
    totals = {y: 0.0 for y in years}
    for t in trades:
        y = pd.Timestamp(t["closeTime"]).year
        if y in totals:
            totals[y] += float(t["profit"])
    positive = sum(v > 0 for v in totals.values())
    worst = min(totals.items(), key=lambda kv: kv[1])
    history_years = max((df.index[-1] - df.index[0]).total_seconds() / (365.25 * 86400), 0.0)
    return 100.0 * positive / len(years), str(worst[0]), f"{years[0]} – {years[-1]}", history_years


def monte_carlo(pnl: np.ndarray, sims: int, seed: int):
    if sims <= 0 or len(pnl) == 0:
        return 0.0, float("inf")
    rng = np.random.default_rng(seed)
    positive = 0
    dd_values = []
    remaining = int(sims)
    while remaining > 0:
        batch = min(250, remaining)
        sample = rng.choice(pnl, size=(batch, len(pnl)), replace=True)
        equity = DEPOSIT + np.cumsum(sample, axis=1)
        with_start = np.concatenate([np.full((batch, 1), DEPOSIT), equity], axis=1)
        peak = np.maximum.accumulate(with_start, axis=1)[:, 1:]
        dd = np.where(peak > 0, (peak - equity) / peak * 100.0, 1000.0)
        dd_values.extend(np.max(dd, axis=1).tolist())
        positive += int(np.sum(equity[:, -1] > DEPOSIT))
        remaining -= batch
    probability = 100.0 * positive / sims
    mc95 = float(np.percentile(np.asarray(dd_values, dtype=float), 95))
    return probability, mc95


def log_return_equity(bar_pnl: np.ndarray) -> np.ndarray:
    equity = DEPOSIT + np.cumsum(np.asarray(bar_pnl, dtype=float))
    if len(equity) < 2 or np.any(equity <= 0):
        return np.full(max(len(equity) - 1, 0), np.nan)
    return np.diff(np.log(equity))


def abs_pearson(a: np.ndarray, b: np.ndarray) -> float:
    x = log_return_equity(a)
    y = log_return_equity(b)
    n = min(len(x), len(y))
    if n < 3:
        return 0.0
    x = x[-n:]
    y = y[-n:]
    mask = np.isfinite(x) & np.isfinite(y)
    if int(mask.sum()) < 3:
        return 0.0
    x = x[mask]
    y = y[mask]
    if float(np.std(x)) == 0 or float(np.std(y)) == 0:
        return 0.0
    return abs(float(np.corrcoef(x, y)[0, 1]))


def parity_delta(snapshot: dict[str, Any], m: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for key in ("totalTrades", "winRate", "profitFactor", "netProfit", "maxDrawdown", "sqn", "recoveryFactor"):
        if key not in snapshot:
            continue
        expected = float(snapshot[key])
        actual = float(m.get(key, 0))
        out[key] = {"expected": expected, "actual": actual, "delta": actual - expected}
    return out


def replay_one(strategy: dict[str, Any], df: pd.DataFrame, mc_sims: int) -> Replay:
    sig, contract = run_signal(strategy, df)
    sl_pct = float(contract["sl_pct"])
    tp_ratio = float(contract["tp_ratio"])
    if not math.isclose(sl_pct, float(strategy.get("slValue")), rel_tol=0, abs_tol=1e-12):
        raise RuntimeError(f"SL source/farm mismatch: {strategy['id']}")
    if not math.isclose(tp_ratio, float(strategy.get("tpValue")), rel_tol=0, abs_tol=1e-12):
        raise RuntimeError(f"TP source/farm mismatch: {strategy['id']}")

    trades, bar_pnl = bt_copytolive(sig, df, sl_pct, tp_ratio)
    m = metrics_from_trades(trades)
    train, test = walk_forward(trades, df)
    positive_year, worst_year, period, years = yearly_stats(trades, df)
    pnl = np.asarray([float(t["profit"]) for t in trades], dtype=float)
    seed = int(hashlib.sha256(strategy["id"].encode()).hexdigest()[:16], 16) & 0xFFFFFFFF
    mc_prob, mc95 = monte_carlo(pnl, mc_sims, seed)
    mc_pass = mc_prob >= GATE_MIN_MC_PROFIT_PROB_PCT and mc95 <= GATE_MAX_MC95_DD_PCT

    oos_pf = float(test["profitFactor"])
    base_gate = (
        int(m["totalTrades"]) >= GATE_MIN_TRADES
        and float(m["profitFactor"]) >= GATE_MIN_PF
        and float(m["netProfit"]) >= GATE_MIN_NET_PROFIT
        and float(m["maxDrawdown"]) <= GATE_MAX_DD_PCT
        and float(m["expectancy"]) > 0
        and oos_pf >= GATE_MIN_OOS_PF
        and positive_year >= GATE_MIN_POSITIVE_YEAR_PCT
    )
    return Replay(
        strategy_id=strategy["id"], snapshot=strategy, trades=trades, bar_pnl=bar_pnl,
        metrics=m, train=train, test=test, positive_year_pct=positive_year,
        worst_year=worst_year, period=period, history_years=years,
        mc_profit_probability_pct=mc_prob, mc95_dd_pct=mc95, mc_pass=mc_pass,
        base_gate=base_gate, parity=parity_delta(strategy, m),
    )


def apply_global_correlation(rows: list[Replay]):
    eligible = [r for r in rows if r.base_gate]
    n = len(eligible)
    mat = np.eye(n, dtype=float)
    for i in range(n):
        for j in range(i + 1, n):
            c = abs_pearson(eligible[i].bar_pnl, eligible[j].bar_pnl)
            mat[i, j] = mat[j, i] = c

    for i, r in enumerate(eligible):
        r.raw_corr_max = float(max([mat[i, j] for j in range(n) if j != i], default=0.0))

    def quality(r: Replay):
        m = r.metrics
        return (-float(m["profitFactor"]), -float(m["netProfit"]), float(m["maxDrawdown"]), -int(m["totalTrades"]), r.strategy_id)

    kept: list[Replay] = []
    kept_indices: list[int] = []
    for r in sorted(eligible, key=quality):
        i = eligible.index(r)
        conflicts = [j for j in kept_indices if mat[i, j] > CORR_LIMIT + 1e-12]
        if conflicts:
            r.corr_gate = "REMOVED"
            r.corr_max = None
        else:
            kept.append(r)
            kept_indices.append(i)
            r.corr_gate = "PASS"

    for r in kept:
        i = eligible.index(r)
        peers = [mat[i, j] for j in kept_indices if j != i]
        r.corr_max = float(max(peers, default=0.0))
        if r.corr_max > CORR_LIMIT + 1e-12:
            raise RuntimeError(f"post-greedy correlation invariant failed: {r.strategy_id}")

    for r in rows:
        if not r.base_gate:
            r.corr_gate = "BASE_FAIL"
            r.corr_max = None
        r.strict_gate = bool(r.base_gate and r.mc_pass and r.corr_gate == "PASS")
    return kept, mat


def direction(r: Replay) -> str:
    l = int(r.metrics.get("longsTotal", 0))
    s = int(r.metrics.get("shortsTotal", 0))
    if l and s:
        return "BOTH"
    if l:
        return "LONG_ONLY"
    if s:
        return "SHORT_ONLY"
    return "N/A"


def as_row(r: Replay) -> dict[str, Any]:
    m = r.metrics
    s = r.snapshot
    avg_wl = "$" + format(float(m["avgProfit"]), ".2f") + " / -$" + format(float(m["avgLoss"]), ".2f")
    return {
        "Metode": r.strategy_id,
        "TF": s.get("timeframe"),
        "Order": str(s.get("orderType", "pending")).upper(),
        "Direction": direction(r),
        "SL": float(s.get("slValue")),
        "TP": float(s.get("tpValue")),
        "Total Entry": int(m["totalTrades"]),
        "WR": float(m["winRate"]),
        "PF Net": float(m["profitFactor"]),
        "Net Profit": float(m["netProfit"]),
        "EV/Trade": float(m["expectancy"]),
        "Avg Win/Loss": avg_wl,
        "Max DD": float(m["maxDrawdown"]),
        "Recovery Factor": float(m["recoveryFactor"]),
        "Max Consecutive Loss": int(m["maxConsecLoss"]),
        "SQN": float(m["sqn"]),
        "OOS PF": float(r.test["profitFactor"]),
        "Monte Carlo Pass": "PASS" if r.mc_pass else "FAIL",
        "MC 95% DD": float(r.mc95_dd_pct),
        "Positive Year": float(r.positive_year_pct),
        "Worst Year": r.worst_year,
        "Periode Backtest": r.period,
        "History": float(r.history_years),
        "Sample v11": f"{int(m['totalTrades'])}/300 {'PASS' if int(m['totalTrades']) >= 300 else 'FAIL'}",
        "Corr Max": "" if r.corr_max is None else float(r.corr_max),
        "Corr Gate": r.corr_gate,
        "Python Script": s["script"]["path"],
        "MT5 Script": "NOT PRESENT",
    }


def write_outputs(out_dir: Path, snapshot: dict[str, Any], data_path: Path, df: pd.DataFrame, rows: list[Replay], kept: list[Replay], mc_sims: int):
    out_dir.mkdir(parents=True, exist_ok=True)
    table = [as_row(r) for r in rows]
    fieldnames = list(table[0].keys()) if table else []
    with (out_dir / "copytolive_gold_replay.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(table)

    summary = {
        "status": "PASS",
        "profile": "copytolive-gold-parity-v1",
        "source_farm_sha256": snapshot["source"]["farm_sha256"],
        "source_state_sha256": snapshot["source"]["state_sha256"],
        "source_engine_sha256": snapshot["source"]["engine_sha256"],
        "dataset_sha256": sha256_file(data_path),
        "dataset_rows": int(len(df)),
        "dataset_start": str(df.index[0]),
        "dataset_end": str(df.index[-1]),
        "strategies_input": len(rows),
        "base_gate_pass": sum(r.base_gate for r in rows),
        "monte_carlo_pass": sum(r.mc_pass for r in rows),
        "corr_kept": len(kept),
        "strict_final_pass": sum(r.strict_gate for r in rows),
        "mc_simulations_per_strategy": int(mc_sims),
        "contract": {
            "deposit_usd": DEPOSIT, "risk_usd_per_trade": RISK, "fee_rate": FEE,
            "entry": "signal_bar_close", "sl_distance": "entry_price * SL_PCT",
            "tp_distance": "SL_distance * TP_RATIO", "lot": "RISK_USD / SL_distance",
            "intrabar_priority": "SL_BEFORE_TP", "walk_forward": "70/30",
        },
        "github_strict_gate": {
            "min_trades": GATE_MIN_TRADES, "min_net_profit_usd": GATE_MIN_NET_PROFIT,
            "min_pf": GATE_MIN_PF, "max_dd_pct": GATE_MAX_DD_PCT,
            "min_oos_pf": GATE_MIN_OOS_PF, "min_positive_year_pct": GATE_MIN_POSITIVE_YEAR_PCT,
            "corr_abs_max": CORR_LIMIT,
            "min_mc_positive_terminal_pct": GATE_MIN_MC_PROFIT_PROB_PCT,
            "max_mc95_dd_pct": GATE_MAX_MC95_DD_PCT,
        },
        "rows": [
            {
                **as_row(r), "Base Gate": "PASS" if r.base_gate else "FAIL",
                "Strict Final": "PASS" if r.strict_gate else "FAIL",
                "Raw Corr Max": float(r.raw_corr_max),
                "MC Profit Probability %": float(r.mc_profit_probability_pct),
                "Parity": r.parity,
            }
            for r in rows
        ],
    }
    (out_dir / "copytolive_gold_replay.json").write_text(json.dumps(summary, indent=2, allow_nan=False) + "\n")
    return summary


def main():
    p = argparse.ArgumentParser(description="Replay exact CopyToLive active GOLD strategy snapshot.")
    p.add_argument("--snapshot", default="backtest/copytolive_gold/active_gold_snapshot.json")
    p.add_argument("--data", required=True, help="H1 OHLCV CSV or Parquet")
    p.add_argument("--out-dir", default="backtest/copytolive_gold/runtime")
    p.add_argument("--mc-sims", type=int, default=1000)
    p.add_argument("--max-strategies", type=int, default=0, help="Debug only; 0 means all 118")
    args = p.parse_args()

    snapshot = load_snapshot(Path(args.snapshot))
    df = load_ohlcv(Path(args.data))
    strategies = list(snapshot["strategies"])
    if args.max_strategies:
        strategies = strategies[: args.max_strategies]

    rows: list[Replay] = []
    errors = []
    for i, strategy in enumerate(strategies, 1):
        try:
            row = replay_one(strategy, df, int(args.mc_sims))
            rows.append(row)
            print(
                f"[{i:03d}/{len(strategies):03d}] {strategy['id']} "
                f"trades={row.metrics['totalTrades']} pf={row.metrics['profitFactor']:.3f} "
                f"dd={row.metrics['maxDrawdown']:.2f}% oos={row.test['profitFactor']:.3f}"
            )
        except Exception as exc:
            errors.append({"id": strategy.get("id"), "error": f"{type(exc).__name__}: {exc}"})
            print(f"[{i:03d}/{len(strategies):03d}] ERROR {strategy.get('id')}: {exc}")

    if errors:
        out = Path(args.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        (out / "errors.json").write_text(json.dumps(errors, indent=2) + "\n")
        raise RuntimeError(f"{len(errors)} strategy replay error(s); see {out/'errors.json'}")
    if not args.max_strategies and len(rows) != 118:
        raise RuntimeError(f"expected 118 completed strategy replays, got {len(rows)}")

    kept, _ = apply_global_correlation(rows)
    summary = write_outputs(Path(args.out_dir), snapshot, Path(args.data), df, rows, kept, int(args.mc_sims))
    print(json.dumps({k: v for k, v in summary.items() if k != "rows"}, indent=2))


if __name__ == "__main__":
    main()
