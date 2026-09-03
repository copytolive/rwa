from __future__ import annotations

"""Single canonical CopyToLive backtest execution engine.

This module is the one execution kernel intended to be used by:
- GitHub-hosted replay/certification
- CopyToLive production trading-service
- local/macOS reference runs

Strategy discovery, data acquisition, ranking and reporting may differ by lane,
but order execution and metric semantics must come from this module only.
"""

from dataclasses import dataclass
import hashlib
import json
import math
from typing import Iterable

import numpy as np
import pandas as pd

ENGINE_ID = "copytolive-unified-backtest-v1"
COPYTOLIVE_DEPOSIT_USD = 10_000.0
COPYTOLIVE_RISK_USD = 200.0
COPYTOLIVE_STRESSED_FEE = 0.0016
COPYTOLIVE_WF_TRAIN_PCT = 0.70

COPYTOLIVE_SL_PCTS = (0.010, 0.012, 0.015, 0.018, 0.020, 0.025, 0.030, 0.040)
COPYTOLIVE_TP_RATIOS = (1.0, 1.2, 1.5, 2.0, 2.5, 3.0)


@dataclass(frozen=True)
class CopyToLiveExecutionConfig:
    sl_pct: float
    tp_ratio: float
    deposit_usd: float = COPYTOLIVE_DEPOSIT_USD
    risk_usd: float = COPYTOLIVE_RISK_USD
    fee: float = COPYTOLIVE_STRESSED_FEE

    def validate(self) -> None:
        if not (0.0 < float(self.sl_pct) < 1.0):
            raise ValueError("sl_pct must be a positive fraction of entry price")
        if float(self.tp_ratio) <= 0.0:
            raise ValueError("tp_ratio must be positive")
        if float(self.deposit_usd) <= 0.0:
            raise ValueError("deposit_usd must be positive")
        if float(self.risk_usd) <= 0.0:
            raise ValueError("risk_usd must be positive")
        if float(self.fee) < 0.0:
            raise ValueError("fee must be non-negative")

    @property
    def config_hash(self) -> str:
        raw = json.dumps(
            {
                "sl_pct": round(float(self.sl_pct), 10),
                "tp_ratio": round(float(self.tp_ratio), 10),
                "deposit_usd": round(float(self.deposit_usd), 10),
                "risk_usd": round(float(self.risk_usd), 10),
                "fee": round(float(self.fee), 10),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        return hashlib.sha256(raw).hexdigest()


def _column(df: pd.DataFrame, name: str) -> np.ndarray:
    for candidate in (name, name.lower(), name.capitalize(), name.upper()):
        if candidate in df.columns:
            return pd.to_numeric(df[candidate], errors="coerce").to_numpy(float)
    raise ValueError(f"missing required OHLC column: {name}")


def _time_index(df: pd.DataFrame) -> pd.Index:
    if isinstance(df.index, pd.DatetimeIndex):
        return df.index
    for name in ("Date", "date", "time", "timestamp", "datetime"):
        if name in df.columns:
            return pd.DatetimeIndex(pd.to_datetime(df[name], errors="coerce"))
    return pd.RangeIndex(len(df))


def _as_signals(signals: Iterable[int], n: int) -> np.ndarray:
    out = np.asarray(list(signals) if not isinstance(signals, np.ndarray) else signals, dtype=np.int8)
    if len(out) != n:
        raise ValueError(f"signal length mismatch: signals={len(out)} bars={n}")
    return np.sign(out).astype(np.int8)


def _rolling_mean(x: np.ndarray, n: int) -> np.ndarray:
    return pd.Series(np.asarray(x, dtype=float)).rolling(int(n), min_periods=int(n)).mean().to_numpy(float)


def compute_vol_mask(df: pd.DataFrame) -> np.ndarray:
    """Production VOL mask: simple ATR14 > simple MA50(ATR14)."""
    high = _column(df, "high")
    low = _column(df, "low")
    close = _column(df, "close")
    prev = np.r_[np.nan, close[:-1]]
    tr = np.nanmax(
        np.vstack(
            [
                high - low,
                np.abs(high - prev),
                np.abs(low - prev),
            ]
        ),
        axis=0,
    )
    if len(tr):
        tr[0] = high[0] - low[0]
    atr14 = _rolling_mean(tr, 14)
    atr_ma50 = _rolling_mean(atr14, 50)
    return np.isfinite(atr14) & np.isfinite(atr_ma50) & (atr14 > atr_ma50)


def compute_session_mask(df: pd.DataFrame) -> np.ndarray:
    """Production session mask: direct wall-clock hour 07:00..21:59 inclusive."""
    idx = _time_index(df)
    if not isinstance(idx, pd.DatetimeIndex):
        raise ValueError("session filter requires a DatetimeIndex or timestamp column")
    hour = idx.hour.to_numpy()
    return (hour >= 7) & (hour <= 21)


def compute_mtf_bias(h1: pd.DataFrame, d1: pd.DataFrame) -> np.ndarray:
    """Production MTF bias.

    The historical producer expands D1 EMA50/EMA200 bias by integer blocks:
    h1_per_d1 = len(H1) // len(D1), starting from D1 row 200.
    This deliberately preserves the producer's row-count mapping rather than
    replacing it with timestamp reindexing.
    """
    n = len(h1)
    dclose = _column(d1, "close")
    out = np.zeros(n, dtype=np.int8)
    if n == 0 or len(dclose) == 0:
        return out

    s = pd.Series(dclose, dtype=float)
    ema50 = s.ewm(span=50).mean().to_numpy(float)
    ema200 = s.ewm(span=200).mean().to_numpy(float)
    h1_per_d1 = n // len(dclose)
    if h1_per_d1 <= 0:
        return out

    for j in range(200, len(dclose)):
        if not (np.isfinite(ema50[j]) and np.isfinite(ema200[j])):
            continue
        bias = 1 if ema50[j] > ema200[j] else (-1 if ema50[j] < ema200[j] else 0)
        a = j * h1_per_d1
        b = min((j + 1) * h1_per_d1, n)
        if a >= n:
            break
        out[a:b] = bias
    return out


def filter_mode_from_signal_type(signal_type: str | None) -> str:
    s = str(signal_type or "").upper()
    for mode in ("VOL", "MTF", "VM", "VS", "ALL"):
        if s.startswith(mode + "_"):
            return mode
    return "NONE"


def apply_production_filter(
    signals: Iterable[int],
    h1: pd.DataFrame,
    *,
    signal_type: str | None = None,
    d1: pd.DataFrame | None = None,
) -> np.ndarray:
    """Apply the producer's external filter family to base strategy signals."""
    sig = _as_signals(signals, len(h1))
    mode = filter_mode_from_signal_type(signal_type)
    if mode == "NONE":
        return sig

    vol = compute_vol_mask(h1) if mode in {"VOL", "VM", "VS", "ALL"} else np.ones(len(h1), dtype=bool)
    ses = compute_session_mask(h1) if mode in {"VS", "ALL"} else np.ones(len(h1), dtype=bool)

    if mode in {"MTF", "VM", "ALL"}:
        if d1 is None:
            raise ValueError(f"{mode} filter requires D1 data")
        bias = compute_mtf_bias(h1, d1)
        mtf = ((sig > 0) & (bias > 0)) | ((sig < 0) & (bias < 0))
    else:
        mtf = np.ones(len(h1), dtype=bool)

    keep = vol & ses & mtf
    return np.where(keep, sig, 0).astype(np.int8)


def run_copytolive_backtest(
    df: pd.DataFrame,
    signals: Iterable[int],
    config: CopyToLiveExecutionConfig,
) -> dict:
    """Run the canonical CopyToLive single-position execution model."""
    config.validate()
    if len(df) < 2:
        return {"trades": [], "bar_pnl": np.zeros(len(df), dtype=float), "metrics": empty_metrics()}

    close = _column(df, "close")
    high = _column(df, "high")
    low = _column(df, "low")
    if np.any(~np.isfinite(close)) or np.any(~np.isfinite(high)) or np.any(~np.isfinite(low)):
        raise ValueError("OHLC contains non-finite values")

    sigs = _as_signals(signals, len(df))
    idx = _time_index(df)
    bar_pnl = np.zeros(len(df), dtype=float)
    trades: list[dict] = []
    pos: dict | None = None
    equity = float(config.deposit_usd)

    for i in range(len(df)):
        if pos is None:
            if sigs[i] == 0:
                continue
            entry = float(close[i])
            stop_distance = entry * float(config.sl_pct)
            if stop_distance <= 0.0:
                continue
            target_distance = stop_distance * float(config.tp_ratio)
            quantity = float(config.risk_usd) / stop_distance
            pos = {
                "side": int(sigs[i]),
                "entry": entry,
                "stop_distance": stop_distance,
                "target_distance": target_distance,
                "quantity": quantity,
                "entry_bar": int(i),
                "entry_time": idx[i],
            }
            # No same-bar entry+exit.
            continue

        side = int(pos["side"])
        entry = float(pos["entry"])
        sl = float(pos["stop_distance"])
        tp = float(pos["target_distance"])
        qty = float(pos["quantity"])
        fee_usd = float(config.fee) * entry * qty

        exit_price: float | None = None
        exit_type = ""
        gross = 0.0

        # Conservative same-bar precedence: SL before TP.
        if side == 1:
            if low[i] <= entry - sl:
                exit_price = entry - sl
                exit_type = "SL"
                gross = -sl * qty
            elif high[i] >= entry + tp:
                exit_price = entry + tp
                exit_type = "TP"
                gross = tp * qty
        else:
            if high[i] >= entry + sl:
                exit_price = entry + sl
                exit_type = "SL"
                gross = -sl * qty
            elif low[i] <= entry - tp:
                exit_price = entry - tp
                exit_type = "TP"
                gross = tp * qty

        if exit_price is None:
            continue

        net = float(gross - fee_usd)
        equity += net
        bar_pnl[i] += net
        trades.append(
            {
                "openTime": str(pos["entry_time"])[:32],
                "closeTime": str(idx[i])[:32],
                "type": "BUY" if side == 1 else "SELL",
                "openPrice": entry,
                "closePrice": float(exit_price),
                "quantity": qty,
                "lots": qty,
                "grossProfit": float(gross),
                "fee": float(fee_usd),
                "profit": net,
                "balance": float(equity),
                "exitType": exit_type,
                "entryBar": int(pos["entry_bar"]),
                "exitBar": int(i),
                "slDistance": sl,
                "tpDistance": tp,
                "slPct": float(config.sl_pct),
                "tpRatio": float(config.tp_ratio),
                "riskUsd": float(config.risk_usd),
            }
        )
        pos = None

    # Production producer discards an unclosed final position.
    metrics = compute_copytolive_metrics(trades, float(config.deposit_usd))
    return {
        "engine_id": ENGINE_ID,
        "trades": trades,
        "bar_pnl": bar_pnl,
        "metrics": metrics,
        "execution_config": {
            "sl_pct": float(config.sl_pct),
            "tp_ratio": float(config.tp_ratio),
            "deposit_usd": float(config.deposit_usd),
            "risk_usd": float(config.risk_usd),
            "fee": float(config.fee),
        },
        "open_position_at_end": pos,
    }


def empty_metrics() -> dict:
    return {
        "totalTrades": 0,
        "winRate": 0.0,
        "profitFactor": 0.0,
        "maxDrawdown": 0.0,
        "netProfit": 0.0,
        "expectancy": 0.0,
        "sqn": 0.0,
        "sharpe": 0.0,
        "sortino": 0.0,
        "recoveryFactor": 0.0,
        "avgProfit": 0.0,
        "avgLoss": 0.0,
        "rr": 0.0,
        "maxConsecLoss": 0,
    }


def compute_copytolive_metrics(trades: list[dict], deposit_usd: float = COPYTOLIVE_DEPOSIT_USD) -> dict:
    if not trades:
        return empty_metrics()

    pnl = np.asarray([float(t["profit"]) for t in trades], dtype=float)
    wins = pnl[pnl > 0]
    losses = pnl[pnl <= 0]
    gp = float(wins.sum()) if len(wins) else 0.0
    gl = abs(float(losses.sum())) if len(losses) else 0.0
    total = int(len(pnl))
    wr = 100.0 * len(wins) / total
    pf = gp / gl if gl > 0 else float("inf")
    net = float(pnl.sum())
    expectancy = net / total

    equity = float(deposit_usd) + np.cumsum(pnl)
    peaks = np.maximum.accumulate(np.r_[float(deposit_usd), equity])[1:]
    dd_pct = np.where(peaks > 0, (peaks - equity) / peaks * 100.0, 0.0)
    max_dd_pct = float(dd_pct.max(initial=0.0))

    std = float(np.std(pnl))
    sqn = float(np.mean(pnl) / std * math.sqrt(total)) if std > 0 else 0.0
    sharpe = float(np.mean(pnl) / std * math.sqrt(252.0)) if std > 0 else 0.0
    down = pnl[pnl < 0]
    down_std = float(np.std(down)) if len(down) > 1 else 0.0
    sortino = float(np.mean(pnl) / down_std * math.sqrt(252.0)) if down_std > 0 else 0.0

    avg_win = float(wins.mean()) if len(wins) else 0.0
    avg_loss = abs(float(losses.mean())) if len(losses) else 0.0
    rr = avg_win / avg_loss if avg_loss > 0 else 0.0
    recovery = net / (max_dd_pct / 100.0 * float(deposit_usd)) if max_dd_pct > 0.01 else 0.0

    max_consec_loss = 0
    cur = 0
    for p in pnl:
        if p <= 0:
            cur += 1
            max_consec_loss = max(max_consec_loss, cur)
        else:
            cur = 0

    return {
        "totalTrades": total,
        "winningTrades": int(len(wins)),
        "losingTrades": int(len(losses)),
        "winRate": float(wr),
        "profitFactor": float(pf),
        "maxDrawdown": float(max_dd_pct),
        "netProfit": net,
        "expectancy": float(expectancy),
        "sqn": sqn,
        "sharpe": sharpe,
        "sortino": sortino,
        "recoveryFactor": float(recovery),
        "grossProfit": gp,
        "grossLoss": gl,
        "avgProfit": avg_win,
        "avgLoss": avg_loss,
        "rr": float(rr),
        "maxConsecLoss": int(max_consec_loss),
    }


def validate_copytolive_period(
    trades: list[dict],
    *,
    min_trades: int = 100,
    pf_min: float = 2.0,
    wr_min: float = 40.0,
    wr_max: float = 85.0,
    dd_max: float = 30.0,
    deposit_usd: float = COPYTOLIVE_DEPOSIT_USD,
) -> dict | None:
    metrics = compute_copytolive_metrics(trades, deposit_usd)
    if int(metrics["totalTrades"]) < int(min_trades):
        return None
    if not (float(wr_min) <= float(metrics["winRate"]) <= float(wr_max)):
        return None
    if float(metrics["profitFactor"]) < float(pf_min):
        return None
    if float(metrics["maxDrawdown"]) > float(dd_max):
        return None
    return metrics


def walk_forward_copytolive(
    trades: list[dict],
    df: pd.DataFrame,
    *,
    train_pct: float = COPYTOLIVE_WF_TRAIN_PCT,
) -> tuple[dict | None, dict | None, dict | None]:
    if not trades or len(df) < 2:
        return None, None, None
    if not (0.0 < float(train_pct) < 1.0):
        raise ValueError("train_pct must be between 0 and 1")

    idx = _time_index(df)
    split_i = min(max(int(len(df) * float(train_pct)), 1), len(df) - 1)
    split_ts = idx[split_i]

    def _close_ts(t: dict):
        try:
            return pd.Timestamp(t["closeTime"])
        except Exception:
            return None

    train, test = [], []
    for t in trades:
        ts = _close_ts(t)
        if ts is None:
            continue
        (train if ts <= split_ts else test).append(t)

    return (
        validate_copytolive_period(train, min_trades=100),
        validate_copytolive_period(test, min_trades=50),
        validate_copytolive_period(trades, min_trades=300),
    )


def execution_digest(trades: list[dict]) -> str:
    if not trades:
        return ""
    canonical = [
        {
            "entryBar": int(t["entryBar"]),
            "exitBar": int(t["exitBar"]),
            "type": str(t["type"]),
            "openPrice": round(float(t["openPrice"]), 10),
            "closePrice": round(float(t["closePrice"]), 10),
            "quantity": round(float(t.get("quantity", t.get("lots", 0.0))), 10),
            "profit": round(float(t["profit"]), 10),
            "exitType": str(t["exitType"]),
        }
        for t in trades
    ]
    raw = json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.blake2b(raw, digest_size=16).hexdigest()


def adapt_core_candidate_signals(df: pd.DataFrame, candidate) -> np.ndarray:
    """Reuse legacy public signal families while switching only execution semantics."""
    from core import signal_series
    return np.asarray(signal_series(df, candidate), dtype=np.int8)
