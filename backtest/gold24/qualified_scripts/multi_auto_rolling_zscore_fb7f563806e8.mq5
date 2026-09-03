#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f3/s8 p1=2.1 p2=55.0 p3=1.0 off=0.5 exp=4 | hash fb7f563806e87d7780b3385431665ddc8cdc9c76532ee92d05cee3fb1bb05016
#define MM_FAMILY_CODE 44
#define MM_FAST 3
#define MM_SLOW 8
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "fb7f563806e87d7780b3385431665ddc8cdc9c76532ee92d05cee3fb1bb05016"
#define MM_MAGIC 24326360
#define MM_TAG "GOLD10B_MULTI_049"
#include "multimethod_engine.mqh"
