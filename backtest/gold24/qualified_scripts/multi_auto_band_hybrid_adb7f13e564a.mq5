#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BAND_HYBRID f5/s13 p1=1.0 p2=1.5 p3=1.0 off=1.0 exp=4 | hash adb7f13e564aa84c602bb29fb8f74af3f9033c97b17708d4f1748e0614455a87
#define MM_FAMILY_CODE 20
#define MM_FAST 5
#define MM_SLOW 13
#define MM_P1 1.0
#define MM_P2 1.5
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "adb7f13e564aa84c602bb29fb8f74af3f9033c97b17708d4f1748e0614455a87"
#define MM_MAGIC 24213214
#define MM_TAG "GOLD10B_MULTI_096"
#include "multimethod_engine.mqh"
