#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s34 p1=1.0 p2=55.0 p3=1.0 off=0.75 exp=6 | hash 6b892b882269e2aaa2becad843d2fd78d915f1dffa0835a917b1dfce81b0e530
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "6b892b882269e2aaa2becad843d2fd78d915f1dffa0835a917b1dfce81b0e530"
#define MM_MAGIC 24251688
#define MM_TAG "GOLD10B_MULTI_005"
#include "multimethod_engine.mqh"
