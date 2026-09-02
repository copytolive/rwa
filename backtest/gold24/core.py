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
    # Existing 24 production families.
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
    "CHART_PATTERN": 10,
    "MARKET_STRUCTURE": 11,
    "SUPPORT_RESISTANCE": 12,
    "FIBONACCI": 13,
    "VOLATILITY": 14,
    "BAND_HYBRID": 15,
    "ICHIMOKU": 16,
    "ADAPTIVE_TREND": 17,
    "DIVERGENCE": 18,
    "VOLUME": 19,
    "VWAP": 20,
    "STATISTICAL": 21,
    "RELATIVE_STRENGTH": 22,
    "MULTI_TIMEFRAME": 23,

    # 22 new D1-real remix families. These are distinct signal engines, not
    # parameter aliases of Candle/Donchian.
    "ADX_TREND": 24,
    "TURTLE_BREAKOUT": 25,
    "ATR_CHANNEL": 26,
    "EMA_PULLBACK": 27,
    "MACD_MOMENTUM": 28,
    "RSI_MOMENTUM": 29,
    "RSI_REVERSION": 30,
    "BOLLINGER_REVERSION_V2": 31,
    "BOLLINGER_SQUEEZE": 32,
    "KELTNER_SQUEEZE": 33,
    "FRACTAL_BREAKOUT": 34,
    "BOS_CHOCH": 35,
    "PIVOT_SR": 36,
    "FIB_PULLBACK": 37,
    "ICHIMOKU_KUMO_BREAKOUT": 38,
    "ICHIMOKU_PULLBACK": 39,
    "SUPERTREND_ATR": 40,
    "CHANDELIER_TREND": 41,
    "ROLLING_ZSCORE": 42,
    "LINEAR_REGRESSION": 43,
    "VOLATILITY_REGIME": 44,
    "TREND_MEANREV_ENSEMBLE": 45,
}

# Registered target families that MUST NOT be simulated from D1 resampling.
# They become implemented only after real canonical H4 data is added and
# independently Gate-A audited.
DATA_BLOCKED_NATIVE_MTF_FAMILIES = {
    "H4_D1_MTF_NATIVE",
    "D1_H4_PULLBACK_NATIVE",
}
TARGET_ENGINE_FAMILY_COUNT = 48
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


def _kama(x: np.ndarray, n: int) -> np.ndarray:
    """Causal Kaufman adaptive moving average."""
    s = pd.Series(x, dtype=float)
    change = (s - s.shift(n)).abs()
    volatility = s.diff().abs().rolling(n).sum().replace(0, np.nan)
    er = (change / volatility).fillna(0.0).clip(0.0, 1.0).to_numpy(float)
    fast_sc = 2.0 / (2.0 + 1.0)
    slow_sc = 2.0 / (30.0 + 1.0)
    sc = (er * (fast_sc - slow_sc) + slow_sc) ** 2
    out = np.empty(len(x), dtype=float)
    out[0] = float(x[0])
    for i in range(1, len(x)):
        out[i] = out[i - 1] + sc[i] * (float(x[i]) - out[i - 1])
    return out


def _adx(h: np.ndarray, l: np.ndarray, c: np.ndarray, n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Causal Wilder-style ADX/+DI/-DI approximation using rolling sums."""
    prev_h = np.r_[np.nan, h[:-1]]
    prev_l = np.r_[np.nan, l[:-1]]
    prev_c = np.r_[np.nan, c[:-1]]
    up = h - prev_h
    down = prev_l - l
    plus_dm = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)
    tr = np.nanmax(np.vstack([h - l, np.abs(h - prev_c), np.abs(l - prev_c)]), axis=0)
    trs = pd.Series(tr).rolling(n, min_periods=n).sum().replace(0, np.nan)
    plus = 100.0 * pd.Series(plus_dm).rolling(n, min_periods=n).sum() / trs
    minus = 100.0 * pd.Series(minus_dm).rolling(n, min_periods=n).sum() / trs
    den = (plus + minus).replace(0, np.nan)
    dx = (100.0 * (plus - minus).abs() / den).fillna(0.0)
    adx = dx.rolling(n, min_periods=n).mean().fillna(0.0)
    return adx.to_numpy(float), plus.fillna(0.0).to_numpy(float), minus.fillna(0.0).to_numpy(float)


def _macd(x: pd.Series, fast_n: int, slow_n: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    macd = _ema(x, fast_n) - _ema(x, slow_n)
    signal = pd.Series(macd).ewm(span=9, adjust=False).mean().to_numpy(float)
    hist = macd - signal
    return macd, signal, hist


def _rolling_linreg_slope(x: np.ndarray, n: int) -> np.ndarray:
    """Fast causal rolling least-squares slope."""
    n = max(2, int(n))
    xx = np.arange(n, dtype=float)
    w = xx - xx.mean()
    den = float(np.dot(w, w))
    out = np.zeros(len(x), dtype=float)
    if len(x) >= n and den > 0:
        out[n - 1:] = np.convolve(np.asarray(x, float), w[::-1] / den, mode="valid")
    return out


def _supertrend_direction(h: np.ndarray, l: np.ndarray, c: np.ndarray, n: int, mult: float) -> tuple[np.ndarray, np.ndarray]:
    """Causal SuperTrend direction and line."""
    atr = _atr(h, l, c, n)
    hl2 = (h + l) * 0.5
    upper = hl2 + float(mult) * atr
    lower = hl2 - float(mult) * atr
    fup = upper.copy()
    flo = lower.copy()
    trend = np.ones(len(c), dtype=np.int8)
    line = np.zeros(len(c), dtype=float)
    for i in range(1, len(c)):
        fup[i] = upper[i] if (upper[i] < fup[i - 1] or c[i - 1] > fup[i - 1]) else fup[i - 1]
        flo[i] = lower[i] if (lower[i] > flo[i - 1] or c[i - 1] < flo[i - 1]) else flo[i - 1]
        if trend[i - 1] > 0:
            trend[i] = -1 if c[i] < flo[i] else 1
        else:
            trend[i] = 1 if c[i] > fup[i] else -1
        line[i] = flo[i] if trend[i] > 0 else fup[i]
    if len(c):
        line[0] = flo[0]
    return trend, line


def _completed_5d_regime(d: pd.DataFrame, fast: int, slow: int) -> np.ndarray:
    """Causal higher-timeframe regime from completed 5-business-day bars.

    The aggregate is formed from D1 data only and is available from the close
    of each completed Friday bar onward. No future daily bar is used.
    """
    idx = pd.DatetimeIndex(pd.to_datetime(d["Date"], utc=True))
    close = pd.Series(pd.to_numeric(d["Close"], errors="raise").to_numpy(float), index=idx)
    weekly = close.resample("W-FRI").last().dropna()
    wf = max(2, int(round(fast / 5)))
    ws = max(wf + 1, int(round(slow / 5)))
    wfast = weekly.ewm(span=wf, adjust=False).mean()
    wslow = weekly.ewm(span=ws, adjust=False).mean()
    regime = pd.Series(np.where(wfast > wslow, 1.0, np.where(wfast < wslow, -1.0, 0.0)), index=weekly.index)
    aligned = regime.reindex(idx, method="ffill").fillna(0.0)
    return aligned.to_numpy(float)


def signal_series(d: pd.DataFrame, cnd: Candidate) -> np.ndarray:
    close = d["Close"].to_numpy(float)
    open_ = d["Open"].to_numpy(float)
    high = d["High"].to_numpy(float)
    low = d["Low"].to_numpy(float)
    volume = d["Volume"].to_numpy(float)
    s = pd.Series(close)
    hs = pd.Series(high)
    ls = pd.Series(low)
    vs = pd.Series(volume)
    fast = _ema(s, cnd.fast)
    slow = _ema(s, cnd.slow)
    rsi = _rsi(s, cnd.fast)
    roc = (s / s.shift(cnd.fast) - 1).fillna(0).to_numpy(float)
    atr = _atr(high, low, close, cnd.fast)
    atr_slow = _atr(high, low, close, cnd.slow)
    sma = s.rolling(cnd.slow).mean().bfill().to_numpy(float)
    std = s.rolling(cnd.slow).std(ddof=0).replace(0, np.nan).bfill().fillna(1).to_numpy(float)
    z = (close - sma) / std
    rh = hs.rolling(cnd.slow).max().shift(1).bfill().to_numpy(float)
    rl = ls.rolling(cnd.slow).min().shift(1).bfill().to_numpy(float)
    rh_fast = hs.rolling(cnd.fast).max().shift(1).bfill().to_numpy(float)
    rl_fast = ls.rolling(cnd.fast).min().shift(1).bfill().to_numpy(float)
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

    elif cnd.family == "HYBRID":
        long = (fast > slow) & (roc > 0) & (rsi > cnd.p2) & (close > sma)
        short = (fast < slow) & (roc < 0) & (rsi < 100 - cnd.p2) & (close < sma)

    elif cnd.family == "CHART_PATTERN":
        tolerance = np.maximum(atr * cnd.p1, 1e-9)
        near_support = np.abs(low - rl) <= tolerance
        near_resistance = np.abs(high - rh) <= tolerance
        prior_support_touch = np.r_[False, near_support[:-1]]
        prior_resistance_touch = np.r_[False, near_resistance[:-1]]
        long = near_support & prior_support_touch & (close > open_) & (close > fast)
        short = near_resistance & prior_resistance_touch & (close < open_) & (close < fast)

    elif cnd.family == "MARKET_STRUCTURE":
        prev_fast_high = np.r_[rh_fast[0], rh_fast[:-1]]
        prev_fast_low = np.r_[rl_fast[0], rl_fast[:-1]]
        higher_low = rl_fast > prev_fast_low
        lower_high = rh_fast < prev_fast_high
        long = (close > rh_fast) & higher_low & (fast > slow)
        short = (close < rl_fast) & lower_high & (fast < slow)

    elif cnd.family == "SUPPORT_RESISTANCE":
        tolerance = np.maximum(atr * cnd.p1, 1e-9)
        long = (low <= rl + tolerance) & (close > rl) & (close > open_) & (rsi > 50)
        short = (high >= rh - tolerance) & (close < rh) & (close < open_) & (rsi < 50)

    elif cnd.family == "FIBONACCI":
        span = np.maximum(rh - rl, 1e-9)
        pos = (close - rl) / span
        target = cnd.p1
        tol = max(0.03, min(0.12, cnd.p2 / 100.0))
        long = (fast > slow) & (pos >= target - tol) & (pos <= target + tol) & (close > open_)
        short_level = 1.0 - target
        short = (fast < slow) & (pos >= short_level - tol) & (pos <= short_level + tol) & (close < open_)

    elif cnd.family == "VOLATILITY":
        ratio = atr / np.maximum(atr_slow, 1e-9)
        long = (ratio >= cnd.p1) & (close > rh_fast) & (fast > slow)
        short = (ratio >= cnd.p1) & (close < rl_fast) & (fast < slow)

    elif cnd.family == "BAND_HYBRID":
        bb_mult = cnd.p2
        bb_upper = sma + bb_mult * std
        bb_lower = sma - bb_mult * std
        kc_upper = slow + cnd.p1 * atr_slow
        kc_lower = slow - cnd.p1 * atr_slow
        squeeze = (bb_upper < kc_upper) & (bb_lower > kc_lower)
        prev_squeeze = np.r_[False, squeeze[:-1]]
        long = prev_squeeze & (close > bb_upper) & (fast > slow)
        short = prev_squeeze & (close < bb_lower) & (fast < slow)

    elif cnd.family == "ICHIMOKU":
        conv_hi = hs.rolling(cnd.fast, min_periods=1).max().to_numpy(float)
        conv_lo = ls.rolling(cnd.fast, min_periods=1).min().to_numpy(float)
        base_hi = hs.rolling(cnd.slow, min_periods=1).max().to_numpy(float)
        base_lo = ls.rolling(cnd.slow, min_periods=1).min().to_numpy(float)
        conv = (conv_hi + conv_lo) * 0.5
        base = (base_hi + base_lo) * 0.5
        span_a = (conv + base) * 0.5
        span_b_n = min(max(cnd.slow * 2, cnd.slow + 1), max(cnd.slow + 1, len(d) - 1))
        span_b_hi = hs.rolling(span_b_n, min_periods=1).max().to_numpy(float)
        span_b_lo = ls.rolling(span_b_n, min_periods=1).min().to_numpy(float)
        span_b = (span_b_hi + span_b_lo) * 0.5
        cloud_hi = np.maximum(span_a, span_b)
        cloud_lo = np.minimum(span_a, span_b)
        long = (conv > base) & (close > cloud_hi)
        short = (conv < base) & (close < cloud_lo)

    elif cnd.family == "ADAPTIVE_TREND":
        kama = _kama(close, cnd.fast)
        slope = kama - np.r_[kama[0], kama[:-1]]
        band = cnd.p1 * atr
        long = (close > kama + band) & (slope > 0)
        short = (close < kama - band) & (slope < 0)

    elif cnd.family == "DIVERGENCE":
        rsi_s = pd.Series(rsi)
        prior_price_low = ls.rolling(cnd.slow).min().shift(1).bfill().to_numpy(float)
        prior_price_high = hs.rolling(cnd.slow).max().shift(1).bfill().to_numpy(float)
        prior_rsi_low = rsi_s.rolling(cnd.slow).min().shift(1).bfill().to_numpy(float)
        prior_rsi_high = rsi_s.rolling(cnd.slow).max().shift(1).bfill().to_numpy(float)
        long = (low < prior_price_low) & (rsi > prior_rsi_low + cnd.p1) & (close > open_)
        short = (high > prior_price_high) & (rsi < prior_rsi_high - cnd.p1) & (close < open_)

    elif cnd.family == "VOLUME":
        vol_ma = vs.rolling(cnd.slow).mean().replace(0, np.nan).bfill().fillna(1).to_numpy(float)
        spike = volume >= vol_ma * cnd.p1
        long = spike & (close > rh_fast) & (fast > slow)
        short = spike & (close < rl_fast) & (fast < slow)

    elif cnd.family == "VWAP":
        typical = (high + low + close) / 3.0
        pv = pd.Series(typical * np.maximum(volume, 0.0))
        vv = pd.Series(np.maximum(volume, 0.0))
        denom = vv.rolling(cnd.slow).sum().replace(0, np.nan)
        vwap = (pv.rolling(cnd.slow).sum() / denom).bfill().fillna(s).to_numpy(float)
        dev = np.maximum(std, 1e-9)
        long = (close < vwap - cnd.p1 * dev) & (rsi < cnd.p2)
        short = (close > vwap + cnd.p1 * dev) & (rsi > 100 - cnd.p2)

    elif cnd.family == "STATISTICAL":
        q = min(max(cnd.p1, 0.55), 0.95)
        upper = s.rolling(cnd.slow).quantile(q).shift(1).bfill().to_numpy(float)
        lower = s.rolling(cnd.slow).quantile(1.0 - q).shift(1).bfill().to_numpy(float)
        long = (close > upper) & (fast > slow)
        short = (close < lower) & (fast < slow)

    elif cnd.family == "ADX_TREND":
        adx, plus_di, minus_di = _adx(high, low, close, cnd.fast)
        long = (adx >= cnd.p1) & (plus_di > minus_di) & (fast > slow)
        short = (adx >= cnd.p1) & (minus_di > plus_di) & (fast < slow)

    elif cnd.family == "TURTLE_BREAKOUT":
        slow_slope = slow - np.r_[slow[0], slow[:-1]]
        long = (close > rh_fast) & (slow_slope > 0) & (rsi > cnd.p1)
        short = (close < rl_fast) & (slow_slope < 0) & (rsi < 100 - cnd.p1)

    elif cnd.family == "ATR_CHANNEL":
        upper = fast + cnd.p1 * atr
        lower = fast - cnd.p1 * atr
        long = (close > upper) & (fast > slow)
        short = (close < lower) & (fast < slow)

    elif cnd.family == "EMA_PULLBACK":
        tol = np.maximum(cnd.p1 * atr, 1e-9)
        long = (fast > slow) & (low <= fast + tol) & (close > fast) & (close > open_)
        short = (fast < slow) & (high >= fast - tol) & (close < fast) & (close < open_)

    elif cnd.family == "MACD_MOMENTUM":
        macd, macd_signal, hist = _macd(s, cnd.fast, cnd.slow)
        prev_hist = np.r_[hist[0], hist[:-1]]
        norm = hist / np.maximum(atr, 1e-9)
        long = (macd > macd_signal) & (hist > prev_hist) & (norm >= cnd.p1) & (rsi >= cnd.p2)
        short = (macd < macd_signal) & (hist < prev_hist) & (norm <= -cnd.p1) & (rsi <= 100 - cnd.p2)

    elif cnd.family == "RSI_MOMENTUM":
        long = (fast > slow) & (rsi >= cnd.p1) & (roc > 0)
        short = (fast < slow) & (rsi <= 100 - cnd.p1) & (roc < 0)

    elif cnd.family == "RSI_REVERSION":
        long = (rsi <= cnd.p1) & (close < sma) & (close > open_)
        short = (rsi >= 100 - cnd.p1) & (close > sma) & (close < open_)

    elif cnd.family == "BOLLINGER_REVERSION_V2":
        upper = sma + cnd.p1 * std
        lower = sma - cnd.p1 * std
        prev_close = np.r_[close[0], close[:-1]]
        prev_upper = np.r_[upper[0], upper[:-1]]
        prev_lower = np.r_[lower[0], lower[:-1]]
        long = (prev_close < prev_lower) & (close > lower) & (rsi < cnd.p2)
        short = (prev_close > prev_upper) & (close < upper) & (rsi > 100 - cnd.p2)

    elif cnd.family == "BOLLINGER_SQUEEZE":
        bb_mult = cnd.p2
        upper = sma + bb_mult * std
        lower = sma - bb_mult * std
        bandwidth = (upper - lower) / np.maximum(np.abs(sma), 1e-9)
        squeeze = bandwidth <= cnd.p1
        prev_squeeze = np.r_[False, squeeze[:-1]]
        long = prev_squeeze & (close > rh_fast) & (fast > slow)
        short = prev_squeeze & (close < rl_fast) & (fast < slow)

    elif cnd.family == "KELTNER_SQUEEZE":
        ratio = atr / np.maximum(atr_slow, 1e-9)
        compressed = ratio <= cnd.p1
        prev_compressed = np.r_[False, compressed[:-1]]
        upper = fast + cnd.p2 * atr
        lower = fast - cnd.p2 * atr
        long = prev_compressed & (close > upper) & (fast > slow)
        short = prev_compressed & (close < lower) & (fast < slow)

    elif cnd.family == "FRACTAL_BREAKOUT":
        hser = pd.Series(high)
        lser = pd.Series(low)
        h2 = hser.shift(2)
        l2 = lser.shift(2)
        fractal_h = h2.where(
            (h2 > hser.shift(4)) & (h2 > hser.shift(3)) &
            (h2 >= hser.shift(1)) & (h2 >= hser)
        ).ffill().to_numpy(float)
        fractal_l = l2.where(
            (l2 < lser.shift(4)) & (l2 < lser.shift(3)) &
            (l2 <= lser.shift(1)) & (l2 <= lser)
        ).ffill().to_numpy(float)
        tol = np.maximum(cnd.p1 * atr, 0.0)
        long = np.isfinite(fractal_h) & (close > fractal_h + tol) & (fast > slow)
        short = np.isfinite(fractal_l) & (close < fractal_l - tol) & (fast < slow)

    elif cnd.family == "BOS_CHOCH":
        prev_regime = np.r_[0.0, np.sign(fast[:-1] - slow[:-1])]
        bos_long = (close > rh_fast) & (fast > slow)
        bos_short = (close < rl_fast) & (fast < slow)
        choch_long = (prev_regime <= 0) & (fast > slow) & (close > rh_fast)
        choch_short = (prev_regime >= 0) & (fast < slow) & (close < rl_fast)
        long = (bos_long | choch_long) & (rsi >= cnd.p1)
        short = (bos_short | choch_short) & (rsi <= 100 - cnd.p1)

    elif cnd.family == "PIVOT_SR":
        ph = np.r_[high[0], high[:-1]]
        pl = np.r_[low[0], low[:-1]]
        pc = np.r_[close[0], close[:-1]]
        pivot = (ph + pl + pc) / 3.0
        r1 = 2.0 * pivot - pl
        s1 = 2.0 * pivot - ph
        tol = np.maximum(cnd.p1 * atr, 1e-9)
        long = (low <= s1 + tol) & (close > s1) & (close > open_)
        short = (high >= r1 - tol) & (close < r1) & (close < open_)

    elif cnd.family == "FIB_PULLBACK":
        span = np.maximum(rh - rl, 1e-9)
        long_level = rh - cnd.p1 * span
        short_level = rl + cnd.p1 * span
        tol = np.maximum((cnd.p2 / 100.0) * span, 1e-9)
        long = (fast > slow) & (np.abs(close - long_level) <= tol) & (close > open_)
        short = (fast < slow) & (np.abs(close - short_level) <= tol) & (close < open_)

    elif cnd.family == "ICHIMOKU_KUMO_BREAKOUT":
        conv_hi = hs.rolling(cnd.fast, min_periods=1).max().to_numpy(float)
        conv_lo = ls.rolling(cnd.fast, min_periods=1).min().to_numpy(float)
        base_hi = hs.rolling(cnd.slow, min_periods=1).max().to_numpy(float)
        base_lo = ls.rolling(cnd.slow, min_periods=1).min().to_numpy(float)
        conv = (conv_hi + conv_lo) * 0.5
        base = (base_hi + base_lo) * 0.5
        span_a = (conv + base) * 0.5
        span_b_n = min(max(cnd.slow * 2, cnd.slow + 1), max(cnd.slow + 1, len(d) - 1))
        span_b = (
            hs.rolling(span_b_n, min_periods=1).max().to_numpy(float) +
            ls.rolling(span_b_n, min_periods=1).min().to_numpy(float)
        ) * 0.5
        cloud_hi = np.maximum(span_a, span_b)
        cloud_lo = np.minimum(span_a, span_b)
        prev_close = np.r_[close[0], close[:-1]]
        prev_hi = np.r_[cloud_hi[0], cloud_hi[:-1]]
        prev_lo = np.r_[cloud_lo[0], cloud_lo[:-1]]
        min_thickness = cnd.p1 * atr
        thickness = cloud_hi - cloud_lo
        long = (prev_close <= prev_hi) & (close > cloud_hi) & (conv > base) & (thickness >= min_thickness)
        short = (prev_close >= prev_lo) & (close < cloud_lo) & (conv < base) & (thickness >= min_thickness)

    elif cnd.family == "ICHIMOKU_PULLBACK":
        conv_hi = hs.rolling(cnd.fast, min_periods=1).max().to_numpy(float)
        conv_lo = ls.rolling(cnd.fast, min_periods=1).min().to_numpy(float)
        base_hi = hs.rolling(cnd.slow, min_periods=1).max().to_numpy(float)
        base_lo = ls.rolling(cnd.slow, min_periods=1).min().to_numpy(float)
        conv = (conv_hi + conv_lo) * 0.5
        base = (base_hi + base_lo) * 0.5
        tol = np.maximum(cnd.p1 * atr, 1e-9)
        long = (conv > base) & (close > base) & (low <= base + tol) & (close > open_)
        short = (conv < base) & (close < base) & (high >= base - tol) & (close < open_)

    elif cnd.family == "SUPERTREND_ATR":
        st_dir, st_line = _supertrend_direction(high, low, close, cnd.fast, cnd.p1)
        prev_dir = np.r_[st_dir[0], st_dir[:-1]]
        long = (st_dir > 0) & ((prev_dir < 0) | (close > st_line)) & (fast > slow)
        short = (st_dir < 0) & ((prev_dir > 0) | (close < st_line)) & (fast < slow)

    elif cnd.family == "CHANDELIER_TREND":
        ch_long = rh - cnd.p1 * atr
        ch_short = rl + cnd.p1 * atr
        long = (close > ch_long) & (fast > slow) & (rsi > 50)
        short = (close < ch_short) & (fast < slow) & (rsi < 50)

    elif cnd.family == "ROLLING_ZSCORE":
        prev_z = np.r_[z[0], z[:-1]]
        long = (z >= cnd.p1) & (prev_z < cnd.p1) & (fast > slow)
        short = (z <= -cnd.p1) & (prev_z > -cnd.p1) & (fast < slow)

    elif cnd.family == "LINEAR_REGRESSION":
        slope = _rolling_linreg_slope(close, cnd.slow)
        norm_slope = slope / np.maximum(atr_slow, 1e-9)
        long = (norm_slope >= cnd.p1) & (close > fast) & (rsi > 50)
        short = (norm_slope <= -cnd.p1) & (close < fast) & (rsi < 50)

    elif cnd.family == "VOLATILITY_REGIME":
        ratio = atr / np.maximum(atr_slow, 1e-9)
        trend_long = (ratio >= cnd.p1) & (close > rh_fast) & (fast > slow)
        trend_short = (ratio >= cnd.p1) & (close < rl_fast) & (fast < slow)
        revert_long = (ratio <= cnd.p2) & (z < -1.0) & (rsi < 40)
        revert_short = (ratio <= cnd.p2) & (z > 1.0) & (rsi > 60)
        long = trend_long | revert_long
        short = trend_short | revert_short

    elif cnd.family == "TREND_MEANREV_ENSEMBLE":
        long = (fast > slow) & (z <= -cnd.p1) & (rsi <= cnd.p2) & (close > open_)
        short = (fast < slow) & (z >= cnd.p1) & (rsi >= 100 - cnd.p2) & (close < open_)

    elif cnd.family == "RELATIVE_STRENGTH":
        rs = close / np.maximum(slow, 1e-9) - 1.0
        threshold = cnd.p1 / 100.0
        long = (rs > threshold) & (roc > 0) & (rsi > cnd.p2)
        short = (rs < -threshold) & (roc < 0) & (rsi < 100 - cnd.p2)

    elif cnd.family == "MULTI_TIMEFRAME":
        regime = _completed_5d_regime(d, cnd.fast, cnd.slow)
        long = (regime > 0) & (fast > slow) & (rsi > cnd.p1)
        short = (regime < 0) & (fast < slow) & (rsi < 100 - cnd.p1)

    else:
        raise ValueError(f"unknown family: {cnd.family}")

    out[long & ~short] = 1
    out[short & ~long] = -1
    if cnd.direction_mode == "LONG_ONLY":
        out[out < 0] = 0
    elif cnd.direction_mode == "SHORT_ONLY":
        out[out > 0] = 0
    warmup = max(150, cnd.slow + 2)
    if cnd.family == "ICHIMOKU":
        warmup = max(warmup, cnd.slow * 2 + 2)
    out[: min(warmup, len(out))] = 0
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

    if family == "ADX_TREND":
        p1, p2, p3 = rng.choice([18.0, 20.0, 22.0, 25.0, 28.0, 30.0]), 55.0, 1.0
    elif family == "TURTLE_BREAKOUT":
        p1, p2, p3 = rng.choice([50.0, 52.0, 55.0, 58.0]), 55.0, 1.0
    elif family in {"ATR_BREAKOUT", "KELTNER_BREAKOUT", "VOLATILITY", "ADAPTIVE_TREND", "ATR_CHANNEL"}:
        p1, p2, p3 = rng.choice([0.5, 0.7, 0.9, 1.0, 1.2, 1.5, 1.8, 2.2]), 55.0, 1.0
    elif family in {"EMA_PULLBACK", "FRACTAL_BREAKOUT", "PIVOT_SR", "ICHIMOKU_PULLBACK"}:
        p1, p2, p3 = rng.choice([0.1, 0.2, 0.3, 0.5, 0.7, 1.0]), 55.0, 1.0
    elif family == "MACD_MOMENTUM":
        p1, p2, p3 = rng.choice([0.0, 0.02, 0.05, 0.10, 0.20]), rng.choice([50.0, 52.0, 55.0, 58.0]), 1.0
    elif family == "RSI_MOMENTUM":
        p1, p2, p3 = rng.choice([52.0, 55.0, 58.0, 62.0, 66.0]), 55.0, 1.0
    elif family == "RSI_REVERSION":
        p1, p2, p3 = rng.choice([20.0, 25.0, 30.0, 35.0, 40.0]), 55.0, 1.0
    elif family == "BOLLINGER_REVERSION_V2":
        p1, p2, p3 = rng.choice([1.2, 1.5, 1.8, 2.0, 2.2, 2.6]), rng.choice([25.0, 30.0, 35.0, 40.0]), 1.0
    elif family == "BOLLINGER_SQUEEZE":
        p1, p2, p3 = rng.choice([0.005, 0.01, 0.015, 0.02, 0.03, 0.05]), rng.choice([1.5, 1.8, 2.0, 2.2, 2.5]), 1.0
    elif family == "KELTNER_SQUEEZE":
        p1, p2, p3 = rng.choice([0.6, 0.7, 0.8, 0.9, 1.0]), rng.choice([0.5, 0.7, 1.0, 1.2, 1.5]), 1.0
    elif family == "BOS_CHOCH":
        p1, p2, p3 = rng.choice([50.0, 52.0, 55.0, 58.0]), 55.0, 1.0
    elif family in {"FIBONACCI", "FIB_PULLBACK"}:
        p1, p2, p3 = rng.choice([0.382, 0.5, 0.618, 0.786]), rng.choice([3.0, 5.0, 8.0, 10.0]), 1.0
    elif family == "ICHIMOKU_KUMO_BREAKOUT":
        p1, p2, p3 = rng.choice([0.0, 0.1, 0.2, 0.3, 0.5]), 55.0, 1.0
    elif family == "SUPERTREND_ATR":
        p1, p2, p3 = rng.choice([1.0, 1.5, 2.0, 2.5, 3.0]), 55.0, 1.0
    elif family == "CHANDELIER_TREND":
        p1, p2, p3 = rng.choice([1.5, 2.0, 2.5, 3.0, 3.5, 4.0]), 55.0, 1.0
    elif family == "ROLLING_ZSCORE":
        p1, p2, p3 = rng.choice([0.5, 0.7, 1.0, 1.3, 1.7, 2.1]), 55.0, 1.0
    elif family == "LINEAR_REGRESSION":
        p1, p2, p3 = rng.choice([0.01, 0.02, 0.03, 0.05, 0.08, 0.12]), 55.0, 1.0
    elif family == "VOLATILITY_REGIME":
        p1, p2, p3 = rng.choice([1.05, 1.10, 1.20, 1.30, 1.50]), rng.choice([0.60, 0.70, 0.80, 0.90, 1.00]), 1.0
    elif family == "TREND_MEANREV_ENSEMBLE":
        p1, p2, p3 = rng.choice([0.5, 0.7, 1.0, 1.3, 1.7]), rng.choice([30.0, 35.0, 40.0, 45.0]), 1.0
    elif family in {"ATR_BREAKOUT", "KELTNER_BREAKOUT", "VOLATILITY", "ADAPTIVE_TREND"}:
        p1, p2, p3 = rng.choice([0.5, 0.7, 0.9, 1.0, 1.2, 1.5, 1.8, 2.2]), 55.0, 1.0
    elif family == "BAND_HYBRID":
        p1, p2, p3 = rng.choice([1.0, 1.2, 1.5, 1.8, 2.0]), rng.choice([1.5, 1.8, 2.0, 2.2, 2.5]), 1.0
    elif family in {"BOLLINGER_REVERSION", "VWAP"}:
        p1, p2, p3 = rng.choice([0.7, 1.0, 1.2, 1.5, 1.8, 2.2, 2.6]), rng.choice([25, 30, 35, 40]), 1.0
    elif family == "ZSCORE_REVERSION":
        p1, p2, p3 = rng.choice([0.7, 1.0, 1.3, 1.7, 2.1, 2.7]), rng.choice([25, 30, 35, 40]), 1.0
    elif family in {"MOMENTUM_RSI_ROC", "RELATIVE_STRENGTH"}:
        p1, p2, p3 = rng.choice([0.3, 0.5, 0.8, 1.2, 1.8, 2.5]), rng.choice([52, 55, 58, 62, 66]), 1.0
    elif family in {"CHART_PATTERN", "SUPPORT_RESISTANCE"}:
        p1, p2, p3 = rng.choice([0.2, 0.3, 0.5, 0.7, 1.0]), 55.0, 1.0
    elif family == "DIVERGENCE":
        p1, p2, p3 = rng.choice([2.0, 3.0, 5.0, 8.0, 10.0]), 55.0, 1.0
    elif family == "VOLUME":
        p1, p2, p3 = rng.choice([1.1, 1.2, 1.4, 1.6, 2.0, 2.5]), 55.0, 1.0
    elif family == "STATISTICAL":
        p1, p2, p3 = rng.choice([0.65, 0.70, 0.75, 0.80, 0.85, 0.90]), 55.0, 1.0
    else:
        p1, p2, p3 = rng.choice([52, 55, 58, 62, 66]), rng.choice([52, 55, 58, 62, 66]), 1.0

    c = Candidate("GOLD", timeframe, family, fast, slow, p1, p2, p3, entry_method, direction_mode, sl, tp, offset, expiry)
    validate_candidate(c)
    return c
