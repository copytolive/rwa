#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55 p2=52 p3=1 off=1.75 exp=8 | hash db02ceb03b2a80d41e08ef0271529a78acac546b4dea2d370b8fc71dd9d75dc0
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_SL_USD 16.5
#define MM_TP_USD 21.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_P1 55.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "db02ceb03b2a80d41e08ef0271529a78acac546b4dea2d370b8fc71dd9d75dc0"
#define MM_MAGIC 24090208
#define MM_TAG "GOLD24_MULTI_08"
#include "multimethod_engine.mqh"
