#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s10 p1=1.3 p2=0.9 p3=1.0 off=2.5 exp=11 | hash 4216671312d50c299a98dbc7fd810c480800cf792e5a6d618a6cfd96198b7dd5
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 10
#define MM_P1 1.3
#define MM_P2 0.9
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "4216671312d50c299a98dbc7fd810c480800cf792e5a6d618a6cfd96198b7dd5"
#define MM_MAGIC 24864435
#define MM_TAG "GOLD10B_MULTI_101"
#include "multimethod_engine.mqh"
