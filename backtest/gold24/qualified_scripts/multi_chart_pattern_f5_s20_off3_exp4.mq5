#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// CHART_PATTERN f5/s20 p1=0.7 p2=55.0 p3=1.0 off=3.0 exp=4 | hash 9331592e94eaa3bf1186c511e39d9e834cc3c8d371c6084a0adf79adde392e6a
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 20
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 3.0
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "9331592e94eaa3bf1186c511e39d9e834cc3c8d371c6084a0adf79adde392e6a"
#define MM_MAGIC 24090411
#define MM_TAG "GOLD24_MULTI_11"
#include "multimethod_engine.mqh"
