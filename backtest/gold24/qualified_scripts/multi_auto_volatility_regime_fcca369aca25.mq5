#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s34 p1=1.3 p2=0.8 p3=1.0 off=1.75 exp=2 | hash fcca369aca257288253397d495567bd5ccb62e71669869f674876f641b35fdc0
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 34
#define MM_P1 1.3
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 2
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "fcca369aca257288253397d495567bd5ccb62e71669869f674876f641b35fdc0"
#define MM_MAGIC 24410682
#define MM_TAG "GOLD10B_MULTI_026"
#include "multimethod_engine.mqh"
