#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55 p2=52 p3=1 off=2 exp=5 | hash f2b4a66e680b1bc73f7e7f22c6583368ee0a982fdc0bb958baf7dc45575bc41f
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_SL_USD 20.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090203
#define MM_TAG "GOLD24_MULTI_03"
#include "multimethod_engine.mqh"
