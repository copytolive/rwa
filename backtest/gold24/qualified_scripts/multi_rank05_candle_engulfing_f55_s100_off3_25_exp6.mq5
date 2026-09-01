#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f55/s100 p1=66 p2=52 p3=1 off=3.25 exp=6 | hash 497d743f3d97045c0efc44b6a8a3301665b67bedba4f857bf46dd086229d1014
#define MM_FAMILY_CODE 2
#define MM_FAST 55
#define MM_SLOW 100
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 3.25
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090205
#define MM_TAG "GOLD24_MULTI_05"
#include "multimethod_engine.mqh"
