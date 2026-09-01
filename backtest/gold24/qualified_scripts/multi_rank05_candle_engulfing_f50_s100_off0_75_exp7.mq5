#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f50/s100 p1=66 p2=66 p3=1 off=0.75 exp=7 | hash 4533ce2d7391292be0942cde4628db6f4a126dcbab5a7a5186166c91d2837fef
#define MM_FAMILY_CODE 2
#define MM_FAST 50
#define MM_SLOW 100
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090205
#define MM_TAG "GOLD24_MULTI_05"
#include "multimethod_engine.mqh"
