#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// TREND_EMA f26/s55 p1=66.0 p2=52.0 p3=1.0 off=5.0 exp=8 | hash 17fbb68efd20a257b552f4fc41cacacdb5adb6aed8532a1d83aa57259afecb85
#define MM_FAMILY_CODE 8
#define MM_FAST 26
#define MM_SLOW 55
#define MM_P1 66.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "17fbb68efd20a257b552f4fc41cacacdb5adb6aed8532a1d83aa57259afecb85"
#define MM_MAGIC 24872238
#define MM_TAG "GOLD10B_MULTI_118"
#include "multimethod_engine.mqh"
