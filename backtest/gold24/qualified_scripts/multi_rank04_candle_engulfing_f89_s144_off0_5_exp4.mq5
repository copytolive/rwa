#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f89/s144 p1=52 p2=52 p3=1 off=0.5 exp=4 | hash 92b6ef7e7d74ef51fb9031676bc4920edb2040775ff02599c92b811a01227dd4
#define MM_FAMILY_CODE 2
#define MM_FAST 89
#define MM_SLOW 144
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090204
#define MM_TAG "GOLD24_MULTI_04"
#include "multimethod_engine.mqh"
