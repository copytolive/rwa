#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f3/s34 p1=0.7 p2=55.0 p3=1.0 off=2.5 exp=6 | hash 2f466ee1366cebd77429df24e2938c693b4e28b6cf2848e120ee9b43a3f478e8
#define MM_FAMILY_CODE 3
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 22.5
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "2f466ee1366cebd77429df24e2938c693b4e28b6cf2848e120ee9b43a3f478e8"
#define MM_MAGIC 24445057
#define MM_TAG "GOLD10B_MULTI_014"
#include "multimethod_engine.mqh"
