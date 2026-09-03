#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s34 p1=1.0 p2=55.0 p3=1.0 off=2.5 exp=6 | hash 7e1bc2d544d46004cd8254e9021520720eb1b51dac0226bd971684e483c5b110
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 34
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 21.0
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7e1bc2d544d46004cd8254e9021520720eb1b51dac0226bd971684e483c5b110"
#define MM_MAGIC 24648565
#define MM_TAG "GOLD10B_MULTI_012"
#include "multimethod_engine.mqh"
