#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55 p2=52 p3=1 off=1.5 exp=6 | hash 4aea51fc5e449e7d3fafcdbc72d2c9fc88bfeff76db580f57e9a83cc0dc89c4d
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_SL_USD 18.0
#define MM_TP_USD 23.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090206
#define MM_TAG "GOLD24_MULTI_06"
#include "multimethod_engine.mqh"
