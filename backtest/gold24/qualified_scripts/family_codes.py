from __future__ import annotations

# Stable MT5 family codes. Codes 1..7 are frozen for backward compatibility with
# the already-certified wrappers; the remaining real D1 engine families extend
# the same namespace. DATA_BLOCKED native-H4 families are intentionally absent.
FAMILY_CODES = {
    "DONCHIAN": 1,
    "CANDLE_ENGULFING": 2,
    "CHART_PATTERN": 3,
    "ADAPTIVE_TREND": 4,
    "BOLLINGER_REVERSION_V2": 5,
    "VOLUME": 6,
    "VOLATILITY_REGIME": 7,
    "TREND_EMA": 8,
    "MOMENTUM_RSI_ROC": 9,
    "ATR_BREAKOUT": 10,
    "BOLLINGER_REVERSION": 11,
    "KELTNER_BREAKOUT": 12,
    "PRICE_STRUCTURE": 13,
    "ZSCORE_REVERSION": 14,
    "HYBRID": 15,
    "MARKET_STRUCTURE": 16,
    "SUPPORT_RESISTANCE": 17,
    "FIBONACCI": 18,
    "VOLATILITY": 19,
    "BAND_HYBRID": 20,
    "ICHIMOKU": 21,
    "DIVERGENCE": 22,
    "VWAP": 23,
    "STATISTICAL": 24,
    "RELATIVE_STRENGTH": 25,
    "MULTI_TIMEFRAME": 26,
    "ADX_TREND": 27,
    "TURTLE_BREAKOUT": 28,
    "ATR_CHANNEL": 29,
    "EMA_PULLBACK": 30,
    "MACD_MOMENTUM": 31,
    "RSI_MOMENTUM": 32,
    "RSI_REVERSION": 33,
    "BOLLINGER_SQUEEZE": 34,
    "KELTNER_SQUEEZE": 35,
    "FRACTAL_BREAKOUT": 36,
    "BOS_CHOCH": 37,
    "PIVOT_SR": 38,
    "FIB_PULLBACK": 39,
    "ICHIMOKU_KUMO_BREAKOUT": 40,
    "ICHIMOKU_PULLBACK": 41,
    "SUPERTREND_ATR": 42,
    "CHANDELIER_TREND": 43,
    "ROLLING_ZSCORE": 44,
    "LINEAR_REGRESSION": 45,
    "TREND_MEANREV_ENSEMBLE": 46,
    "REGRESSION_CHANNEL_BREAKOUT": 47,
    "ATR_MEANREV_REGIME": 48,
}

CODE_FAMILIES = {v: k for k, v in FAMILY_CODES.items()}
if len(FAMILY_CODES) != 48 or len(CODE_FAMILIES) != 48:
    raise RuntimeError("family code registry must contain exactly 48 unique real D1 families")
