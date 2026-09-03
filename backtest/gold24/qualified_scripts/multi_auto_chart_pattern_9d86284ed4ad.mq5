#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s10 p1=0.5 p2=55.0 p3=1.0 off=2.0 exp=3 | hash 9d86284ed4adfc90e529ced3529d332621682df137ba3f2c0931868ea35a98bd
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 10
#define MM_P1 0.5
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 21.5
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 3
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "9d86284ed4adfc90e529ced3529d332621682df137ba3f2c0931868ea35a98bd"
#define MM_MAGIC 24515054
#define MM_TAG "GOLD10B_MULTI_064"
#include "multimethod_engine.mqh"
