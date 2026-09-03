#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY f3/s13 p1=1.2 p2=55.0 p3=1.0 off=1.75 exp=2 | hash c85e1a34fa51c31b84a0d339a6b552d74d0087b095379ed63acaef7157d5539d
#define MM_FAMILY_CODE 19
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 1.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 2
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "c85e1a34fa51c31b84a0d339a6b552d74d0087b095379ed63acaef7157d5539d"
#define MM_MAGIC 24110292
#define MM_TAG "GOLD10B_MULTI_033"
#include "multimethod_engine.mqh"
