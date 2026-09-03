#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f55/s100 p1=55 p2=58 p3=1 off=3.25 exp=8 | hash b27c57af4988aa89b12d9421250f8244c1460fb9f1570590c8501579a869a45b
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 55
#define MM_SLOW 100
#define MM_SL_USD 23.0
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 3.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_P1 55.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "b27c57af4988aa89b12d9421250f8244c1460fb9f1570590c8501579a869a45b"
#define MM_MAGIC 24090207
#define MM_TAG "GOLD24_MULTI_07"
#include "multimethod_engine.mqh"
