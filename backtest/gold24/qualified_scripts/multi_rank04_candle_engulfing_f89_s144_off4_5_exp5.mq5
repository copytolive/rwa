#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f89/s144 p1=55 p2=66 p3=1 off=4.5 exp=5 | hash 55208f786ea8f781d6da7ed2444e8287ebe0eb86b3c956569c63d75414cb2626
#define MM_FAMILY_CODE 2
#define MM_FAST 89
#define MM_SLOW 144
#define MM_SL_USD 22.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 4.5
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090204
#define MM_TAG "GOLD24_MULTI_04"
#include "multimethod_engine.mqh"
