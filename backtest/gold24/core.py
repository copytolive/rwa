from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

import numpy as np
import pandas as pd

RULES_SHA256 = "6b7fc2920b48a5db18a3fd63e9c4afd4f0281c84003a4e6ebe141b275110b07e"
ALLOWED_TIMEFRAMES = {"H1", "H4", "D1"}
PENDING_METHODS = {"STOP", "LIMIT"}
SL_MIN = 5.0
SL_MAX = 25.0
TP_MIN = 5.0
TP_MAX = 25.0
COST_FLOOR_RT = 0.0032
NOVELTY_EPS = 1e-12

FAMILIES = {
    "TREND_EMA": 0,
    "MOMENTUM_RSI_ROC": 1,
    "ATR_BREAKOUT": 2,
    "BOLLINGER_REVERSION": 3,
    "KELTNER_BREAKOUT": 4,
    "CANDLE_ENGULFING": 5,
    "PRICE_STRUCTURE": 6,
    "DONCHIAN": 7,
    "ZSCORE_REVERSION": 8,
    "HYBRID": 9,
}
REQUIRED_PORTFOLIO_FAMILIES = {
    "ATR_BREAKOUT", "BOLLINGER_REVERSION", "KELTNER_BREAKOUT",
    "CANDLE_ENGULFING", "PRICE_STRUCTURE",
}


@dataclass(frozen=True)
class Candidate:
    symbol: str
    timeframe: str
    family: str
    fast: int
    slow: int
    p1: float
    p2: float
    p3: float
    entry_method: str
    direction_mode: str
    sl: float
    tp: float
    offset: float
    expiry: int

    def canonical_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "family": self.family,
            "fast": int(self.fast),
            "slow": int(self.slow),
            "p1": round(float(self.p1), 8),
            "p2": round(float(self.p2), 8),
            "p3": round(float(self.p3), 8),
            "entry_method": self.entry_method,
            "direction_mode": self.direction_mode,
            "sl": round(float(self.sl), 8),
            "tp": round(float(self.tp), 8),
            "offset": round(float(self.offset), 8),
            "expiry": int(self.expiry),
        }

    @property
    def config_hash(self) -> str:
        raw = json.dumps(self.canonical_dict(), sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(raw).hexdigest()

    @property
    def rr_reduced(self) -> str:
        sl2 = int(round(self.sl * 2))
        tp2 = int(round(self.tp * 2))
        f = Fraction(tp2, sl2)
        return f"{f.numerator}:{f.denominator}"

    @property
    def fingerprint(self) -> str:
        return f"{self.symbol}|RR={self.rr_reduced}|{self.entry_method}"


def symmetric_ratio_diff(a: float, b: float) -> float:
    a, b = abs(float(a)), abs(float(b))
    if a == b == 0:
        return 0.0
    if min(a, b) == 0:
        return float("inf")
    return max(a, b) / min(a, b) - 1.0


def _at_least(value: float, threshold: float) -> bool:
    """Inclusive threshold comparison with only binary-float representation tolerance."""
    return value > threshold or math.isclose(value, threshold, rel_tol=0.0, abs_tol=NOVELTY_EPS)


def novelty_pass(new: Candidate, prior: Candidate) -> bool:
    if new.symbol != prior.symbol or new.family != prior.family:
        return True
    params = [
        symmetric_ratio_diff(new.fast, prior.fast),
        symmetric_ratio_diff(new.slow, prior.slow),
        symmetric_ratio_diff(new.p1, prior.p1),
        symmetric_ratio_diff(new.p2, prior.p2),
        symmetric_ratio_diff(new.p3, prior.p3),
    ]
    if any(_at_least(x, 0.20) for x in params):
        return True
    if _at_least(symmetric_ratio_diff(new.sl, prior.sl), 0.30):
        return True
    if _at_least(symmetric_ratio_diff(new.tp, prior.tp), 0.30):
        return True
    return False


def validate_candidate(c: Candidate) -> None:
    if c.symbol != "GOLD":
        raise ValueError("GOLD24 is GOLD-only")
    if c.timeframe not in ALLOWED_TIMEFRAMES:
        raise ValueError("timeframe must be H1/H4/D1")
    if c.entry_method not in PENDING_METHODS:
        raise ValueError("market orders forbidden; entry_method must be STOP/LIMIT")
    if not (SL_MIN <= c.sl <= SL_MAX and TP_MIN <= c.tp <= TP_MAX):
        raise ValueError("fixed GOLD SL/TP must each be $5-$25")
    if c.fast < 2 or c.slow <= c.fast:
        raise ValueError("invalid fast/slow windows")
    if c.expiry < 1:
        raise ValueError("pending expiry must be >=1 bar")


def audit_dataset(csv_path: str | Path, crosscheck_receipt: str | Path, timeframe: str) -> tuple[pd.DataFrame, dict]:
    if timeframe not in ALLOWED_TIMEFRAMES:
        raise RuntimeError("GATE_A_FAIL: timeframe must be H1/H4/D1")
    path = Path(csv_path)
    cross = Path(crosscheck_receipt)
    if not path.exists():
        raise RuntimeError("GATE_A_FAIL: canonical dataset file missing")
    if not cross.exists():
        raise RuntimeError("GATE_A_FAIL: approved OANDA/TradingView cross-check receipt missing")
    try:
        receipt = json.loads(cross.read_text())
    except Exception as e:
        raise RuntimeError("GATE_A_FAIL: cross-check receipt invalid JSON") from e
    if not receipt.get("crosscheck_pass"):
        raise RuntimeError("GATE_A_FAIL: crosscheck_pass is not true")
    if receipt.get("provider") not in {"OANDA", "TradingView"}:
        raise RuntimeError("GATE_A_FAIL: cross-check provider must be OANDA or TradingView")

    d = pd.read_csv(path)
    required = ["Date", "Open", "High", "Low", "Close", "Volume"]
    missing = [x for x in required if x not in d.columns]
    if missing:
        raise RuntimeError(f"GATE_A_FAIL: missing columns {missing}")
    dt = pd.to_datetime(d["Date"], errors="coerce", utc=True)
    if dt.isna().any():
        raise RuntimeError("GATE_A_FAIL: invalid UTC timestamps")
    if dt.duplicated().any() or not dt.is_monotonic_increasing:
        raise RuntimeError("GATE_A_FAIL: duplicate or unsorted timestamps")
    numeric = d[["Open", "High", "Low", "Close", "Volume"]].apply(pd.to_numeric, errors="coerce")
    if numeric.isna().any().any():
        raise RuntimeError("GATE_A_FAIL: NaN/null OHLCV")
    o, h, l, c = (numeric[x].to_numpy(float) for x in ["Open", "High", "Low", "Close"])
    if np.any(h < l) or np.any(o < l) or np.any(o > h) or np.any(c < l) or np.any(c > h):
        raise RuntimeError("GATE_A_FAIL: OHLC consistency violation")
    if dt.iloc[-1].year < 2026:
        raise RuntimeError("GATE_A_FAIL: dataset does not reach 2026")

    d = d.copy()
    d["Date"] = dt
    for col in ["Open", "High", "Low", "Close", "Volume"]:
        d[col] = numeric[col].astype(float)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    expected_sha = receipt.get("primary_sha256")
    if expected_sha and expected_sha != sha:
        raise RuntimeError("GATE_A_FAIL: primary SHA256 differs from approved cross-check receipt")
    audit = {
        "gate_a": "PASS",
        "dataset_sha256": sha,
        "rows": int(len(d)),
        "start_utc": str(dt.iloc[0]),
        "end_utc": str(dt.iloc[-1]),
        "zero_volume_rows": int((d["Volume"] <= 0).sum()),
        "crosscheck_provider": receipt["provider"],
        "crosscheck_receipt_sha256": hashlib.sha256(cross.read_bytes()).hexdigest(),
        "rules_sha256": RULES_SHA256,
    }
    return d, audit


def _ema(x: pd.Series, n: int) -> np.ndarray:
    return x.ewm(span=n, adjust=False).mean().to_numpy(float)


def _rsi(x: pd.Series, n: int) -> np.ndarray:
    d = x.diff()
    gain = d.clip(lower=0).rolling(n).mean()
    loss = (-d.clip(upper=0).rolling(n).mean()).replace(0, np.nan)
    return (100 - 100 / (1 + gain / loss)).fillna(50).to_numpy(float)


def _atr(h: np.ndarray, l: np.ndarray, c: np.ndarray, n: int) -> np.ndarray:
    prev = np.r_[np.nan, c[:-1]]
    tr = np.nanmax(np.vstack([h - l, np.abs(h - prev), np.abs(l - prev)]), axis=0)
    return pd.Series(tr).rolling(n).mean().bfill().to_numpy(float)


def signal_series(d: pd.DataFrame, cnd: Candidate) -> np.ndarray:
    close = d["Close"].to_numpy(float)
    open_ = d["Open"].to_numpy(float)
    high = d["High"].to_numpy(float)
    low = d["Low"].to_numpy(float)
    s = pd.Series(close)
    fast = _ema(s, cnd.fast)
    slow = _ema(s, cnd.slow)
    rsi = _rsi(s, cnd.fast)
    roc = (s / s.shift(cnd.fast) - 1).fillna(0).to_numpy(float)
    atr = _atr(high, low, close, cnd.fast)
    sma = s.rolling(cnd.slow).mean().bfill().to_numpy(float)
    std = s.rolling(cnd.slow).std(ddof=0).replace(0, np.nan).bfill().fillna(1).to_numpy(float)
    z = (close - sma) / std
    rh = pd.Series(high).rolling(cnd.slow).max().shift(1).bfill().to_numpy(float)
    rl = pd.Series(low).rolling(cnd.slow).min().shift(1).bfill().to_numpy(float)
    out = np.zeros(len(d), dtype=np.int8)

    if cnd.family == "TREND_EMA":
        long = (fast > slow) & (rsi > cnd.p1)
        short = (fast < slow) & (rsi < 100 - cnd.p1)
    elif cnd.family == "MOMENTUM_RSI_ROC":
        long = (roc > cnd.p1 / 100) & (rsi > cnd.p2)
        short = (roc < -cnd.p1 / 100) & (rsi < 100 - cnd.p2)
    elif cnd.family == "ATR_BREAKOUT":
        long = (close > sma + cnd.p1 * atr) & (fast > slow)
        short = (close < sma - cnd.p1 * atr) & (fast < slow)
    elif cnd.family == "BOLLINGER_REVERSION":
        upper = sma + cnd.p1 * std
        lower = sma - cnd.p1 * std
        long = (close < lower) & (rsi < cnd.p2)
        short = (close > upper) & (rsi > 100 - cnd.p2)
    elif cnd.family == "KELTNER_BREAKOUT":
        upper = slow + cnd.p1 * atr
        lower = slow - cnd.p1 * atr
        long = (close > upper) & (fast > slow)
        short = (close < lower) & (fast < slow)
    elif cnd.family == "CANDLE_ENGULFING":
        po = np.r_[open_[0], open_[:-1]]
        pc = np.r_[close[0], close[:-1]]
        bull = (close > open_) & (pc < po) & (close >= po) & (open_ <= pc)
        bear = (close < open_) & (pc > po) & (close <= po) & (open_ >= pc)
        long = bull & (fast > slow)
        short = bear & (fast < slow)
    elif cnd.family == "PRICE_STRUCTURE":
        long = (close > rh) & (fast > slow)
        short = (close < rl) & (fast < slow)
    elif cnd.family == "DONCHIAN":
        long = (close > rh) & (rsi > 50)
        short = (close < rl) & (rsi < 50)
    elif cnd.family == "ZSCORE_REVERSION":
        long = (z < -cnd.p1) & (rsi < cnd.p2)
        short = (z > cnd.p1) & (rsi > 100 - cnd.p2)
    else:
        long = (fast > slow) & (roc > 0) & (rsi > cnd.p2) & (close > sma)
        short = (fast < slow) & (roc < 0) & (rsi < 100 - cnd.p2) & (close < sma)

    out[long & ~short] = 1
    out[short & ~long] = -1
    if cnd.direction_mode == "LONG_ONLY":
        out[out < 0] = 0
    elif cnd.direction_mode == "SHORT_ONLY":
        out[out > 0] = 0
    out[: max(150, cnd.slow + 2)] = 0
    return out


def _cost(entry: float, exit_: float, qty: float) -> float:
    avg = (abs(entry) + abs(exit_)) * 0.5
    floor = COST_FLOOR_RT * avg * qty
    components = (2 * (0.0010 + 0.0003) * avg + 0.50) * qty
    return max(floor, components)


def backtest_candidate(d: pd.DataFrame, cnd: Candidate, flat_lot: float = 1.0) -> dict:
    validate_candidate(cnd)
    if flat_lot <= 0:
        raise ValueError("flat lot must be positive")
    sig = signal_series(d, cnd)
    dates = d["Date"].to_numpy()
    o = d["Open"].to_numpy(float)
    h = d["High"].to_numpy(float)
    l = d["Low"].to_numpy(float)
    cl = d["Close"].to_numpy(float)
    pending = None
    pos = None
    ledger = []
    bar_pnl = np.zeros(len(d), dtype=float)

    for i in range(len(d)):
        if pos is None and pending is not None and i >= pending["active_idx"]:
            side, level = pending["side"], pending["level"]
            filled = False
            fill = None
            if cnd.entry_method == "STOP":
                if side == 1:
                    if o[i] >= level: fill, filled = o[i], True
                    elif h[i] >= level: fill, filled = level, True
                else:
                    if o[i] <= level: fill, filled = o[i], True
                    elif l[i] <= level: fill, filled = level, True
            else:
                if side == 1:
                    if o[i] < level: fill, filled = o[i], True
                    elif l[i] < level: fill, filled = level, True
                else:
                    if o[i] > level: fill, filled = o[i], True
                    elif h[i] > level: fill, filled = level, True
            if filled:
                pos = {"side": side, "entry_idx": i, "entry_time": dates[i], "entry": float(fill), "pending_type": ("buy_" if side == 1 else "sell_") + cnd.entry_method.lower()}
                pending = None
            elif i >= pending["expire_idx"]:
                pending = None

        if pos is not None:
            side, entry = pos["side"], pos["entry"]
            st = entry - cnd.sl if side == 1 else entry + cnd.sl
            tp = entry + cnd.tp if side == 1 else entry - cnd.tp
            hit_sl = l[i] <= st if side == 1 else h[i] >= st
            hit_tp = h[i] >= tp if side == 1 else l[i] <= tp
            exit_, reason = None, None
            if hit_sl and hit_tp:
                exit_, reason = st, "SL_SAME_BAR_WORST_CASE"
            elif hit_sl:
                exit_ = (o[i] if o[i] < st else st) if side == 1 else (o[i] if o[i] > st else st)
                reason = "SL"
            elif hit_tp:
                exit_ = (o[i] if o[i] > tp else tp) if side == 1 else (o[i] if o[i] < tp else tp)
                reason = "TP"
            if exit_ is not None:
                gross = (float(exit_) - entry) * side * flat_lot
                cost = _cost(entry, float(exit_), flat_lot)
                net = gross - cost
                bar_pnl[i] += net
                ledger.append({
                    "config_hash": cnd.config_hash, "fingerprint": cnd.fingerprint, "family": cnd.family,
                    "entry_time": str(pd.Timestamp(pos["entry_time"])), "exit_time": str(pd.Timestamp(dates[i])),
                    "entry_bar": int(pos["entry_idx"]), "exit_bar": int(i), "side": "LONG" if side == 1 else "SHORT",
                    "pending_order": pos["pending_type"], "entry_price": entry, "exit_price": float(exit_),
                    "fixed_sl": cnd.sl, "fixed_tp": cnd.tp, "quantity": flat_lot, "gross_pnl": gross,
                    "cost": cost, "net_pnl": net, "exit_reason": reason,
                })
                pos = None

        if pos is None and pending is None and sig[i] != 0:
            side = int(sig[i])
            level = cl[i] + cnd.offset if cnd.entry_method == "STOP" and side == 1 else cl[i] - cnd.offset if cnd.entry_method == "STOP" else cl[i] - cnd.offset if side == 1 else cl[i] + cnd.offset
            pending = {"side": side, "level": float(level), "active_idx": i + 1, "expire_idx": i + cnd.expiry}

    ldf = pd.DataFrame(ledger)
    metrics = compute_metrics(d, ldf, bar_pnl, cnd.timeframe)
    return {"candidate": cnd.canonical_dict(), "config_hash": cnd.config_hash, "fingerprint": cnd.fingerprint, "metrics": metrics, "execution_hash": execution_digest(ldf), "ledger": ledger, "bar_pnl": bar_pnl}


def execution_digest(ledger: pd.DataFrame) -> str:
    if ledger.empty:
        return ""
    cols = ["entry_bar", "exit_bar", "side", "pending_order", "entry_price", "exit_price", "fixed_sl", "fixed_tp", "quantity", "net_pnl", "exit_reason"]
    raw = ledger[cols].to_json(orient="records", double_precision=12).encode()
    return hashlib.blake2b(raw, digest_size=16).hexdigest()


def compute_metrics(d: pd.DataFrame, ledger: pd.DataFrame, bar_pnl: np.ndarray, timeframe: str) -> dict:
    if ledger.empty:
        return {"trades": 0, "tier1_pass": False, "tier2_pass_count": 0, "full_metrics_pass": False}
    pnl = ledger["net_pnl"].to_numpy(float)
    wins = pnl[pnl > 0]
    losses = -pnl[pnl <= 0]
    trades = len(pnl)
    gp, gl = wins.sum(), losses.sum()
    net = pnl.sum()
    wr = 100 * len(wins) / trades
    pf = gp / gl if gl > 0 else float("inf")
    exp = net / trades
    std = pnl.std(ddof=1) if trades > 1 else 0
    sqn = math.sqrt(trades) * exp / std if std > 0 else 0.0
    equity = 10000.0 + np.cumsum(bar_pnl)
    peak = np.maximum.accumulate(equity)
    dd_abs = peak - equity
    dd_pct = np.where(peak > 0, dd_abs / peak * 100, 0)
    maxdd_abs = float(dd_abs.max(initial=0))
    maxdd_pct = float(dd_pct.max(initial=0))
    tmp = pd.DataFrame({"Date": pd.to_datetime(d["Date"], utc=True), "pnl": bar_pnl})
    monthly = tmp.set_index("Date")["pnl"].resample("ME").sum()
    mret = monthly / 10000.0
    sharpe = float(mret.mean() / mret.std(ddof=1) * math.sqrt(12)) if len(mret) > 1 and mret.std(ddof=1) > 0 else 0.0
    downside = mret[mret < 0]
    sortino = float(mret.mean() / math.sqrt(float((downside ** 2).mean())) * math.sqrt(12)) if len(downside) and float((downside ** 2).mean()) > 0 else 0.0
    recovery = float(net / maxdd_abs) if maxdd_abs > 0 else 0.0
    years = max((tmp["Date"].iloc[-1] - tmp["Date"].iloc[0]).days / 365.25, 1e-9)
    annual_return = (net / 10000.0) / years
    calmar = float(annual_return / (maxdd_pct / 100)) if maxdd_pct > 0 else 0.0
    avgwin = float(wins.mean()) if len(wins) else 0.0
    avgloss = float(losses.mean()) if len(losses) else 0.0
    avg_win_loss = avgwin / avgloss if avgloss > 0 else 0.0
    profitable_months = 100 * float((monthly > 0).sum()) / max(len(monthly), 1)
    max_consec_loss = 0
    cur = 0
    for x in pnl:
        if x <= 0:
            cur += 1
            max_consec_loss = max(max_consec_loss, cur)
        else:
            cur = 0
    min_trades = 500 if timeframe == "H1" else 300
    min_years = 4 if timeframe == "H1" else 3
    min_pm = 60 if timeframe == "H1" else 55
    tier1 = trades >= min_trades and 50 <= wr <= 75 and 1.2 <= pf <= 8 and 2 <= maxdd_pct <= 25 and exp >= 0.50 and years >= min_years and (timeframe != "H1" or (profitable_months >= 60 and sqn >= 2.0))
    tier2_flags = [sqn >= (2.0 if timeframe == "H1" else 1.5), sharpe >= 0.8, sortino >= 1.0, recovery >= 3.0, calmar >= 1.5, avg_win_loss >= 1.0 or wr > 60, max_consec_loss <= 15, profitable_months >= min_pm]
    tier2_count = sum(bool(x) for x in tier2_flags)
    return {"trades": int(trades), "wins": int(len(wins)), "wr": float(wr), "profit_factor": float(pf), "net_profit": float(net), "expectancy": float(exp), "max_dd_pct": maxdd_pct, "sqn": float(sqn), "sharpe": sharpe, "sortino": sortino, "recovery": recovery, "calmar": calmar, "avg_win_loss": float(avg_win_loss), "max_consec_loss": int(max_consec_loss), "profitable_months_pct": float(profitable_months), "history_years": float(years), "tier1_pass": bool(tier1), "tier2_pass_count": int(tier2_count), "tier2_pass": bool(tier2_count >= 6), "full_metrics_pass": bool(tier1 and tier2_count >= 6)}


def log_return_equity(bar_pnl: np.ndarray) -> np.ndarray:
    equity = 10000.0 + np.cumsum(bar_pnl)
    if np.any(equity <= 0):
        return np.full(max(len(equity) - 1, 0), np.nan)
    return np.diff(np.log(equity))


def pearson_log_equity(a_bar_pnl: np.ndarray, b_bar_pnl: np.ndarray) -> float:
    a, b = log_return_equity(a_bar_pnl), log_return_equity(b_bar_pnl)
    n = min(len(a), len(b))
    if n < 3:
        return 0.0
    a, b = a[-n:], b[-n:]
    mask = np.isfinite(a) & np.isfinite(b)
    if mask.sum() < 3 or np.std(a[mask]) == 0 or np.std(b[mask]) == 0:
        return 0.0
    return float(np.corrcoef(a[mask], b[mask])[0, 1])


def generate_candidate(rng: random.Random, timeframe: str = "D1") -> Candidate:
    family = rng.choice(list(FAMILIES))
    windows = [3, 5, 7, 8, 10, 13, 14, 20, 21, 26, 34, 50, 55, 89, 100, 144]
    fast, slow = sorted(rng.sample(windows, 2))
    entry_method = rng.choice(["STOP", "LIMIT"])
    direction_mode = rng.choice(["BOTH", "LONG_ONLY", "SHORT_ONLY"])
    sl = rng.choice([x / 2 for x in range(10, 51)])
    tp = rng.choice([x / 2 for x in range(10, 51)])
    offset = rng.choice([x / 4 for x in range(2, 21)])
    expiry = rng.randint(1, 8)
    if family in {"ATR_BREAKOUT", "KELTNER_BREAKOUT"}:
        p1, p2, p3 = rng.choice([0.5, 0.7, 0.9, 1.2, 1.5, 1.8, 2.2, 2.8]), 55.0, 1.0
    elif family == "BOLLINGER_REVERSION":
        p1, p2, p3 = rng.choice([1.2, 1.5, 1.8, 2.2, 2.6, 3.0]), rng.choice([25, 30, 35, 40]), 1.0
    elif family == "ZSCORE_REVERSION":
        p1, p2, p3 = rng.choice([0.7, 1.0, 1.3, 1.7, 2.1, 2.7]), rng.choice([25, 30, 35, 40]), 1.0
    elif family == "MOMENTUM_RSI_ROC":
        p1, p2, p3 = rng.choice([0.3, 0.5, 0.8, 1.2, 1.8, 2.5]), rng.choice([52, 55, 58, 62, 66]), 1.0
    else:
        p1, p2, p3 = rng.choice([52, 55, 58, 62, 66]), rng.choice([52, 55, 58, 62, 66]), 1.0
    c = Candidate("GOLD", timeframe, family, fast, slow, p1, p2, p3, entry_method, direction_mode, sl, tp, offset, expiry)
    validate_candidate(c)
    return c
