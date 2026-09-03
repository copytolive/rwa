#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// REGRESSION_CHANNEL_BREAKOUT f34/s89 p1=0.01 p2=2.0 p3=1.0 off=1.75 exp=12 | hash c947a4b770dfbae4475a09554e7ba2191bd181807ffd678721f8d5c39c20612f
#define MM_FAMILY_CODE 47
#define MM_FAST 34
#define MM_SLOW 89
#define MM_P1 0.01
#define MM_P2 2.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "c947a4b770dfbae4475a09554e7ba2191bd181807ffd678721f8d5c39c20612f"
#define MM_MAGIC 24215639
#define MM_TAG "GOLD10B_MULTI_114"
#include "multimethod_engine.mqh"
