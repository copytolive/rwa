#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// REGRESSION_CHANNEL_BREAKOUT f13/s89 p1=0.02 p2=2.0 p3=1.0 off=2.5 exp=8 | hash d1d421b5ea30a8e63e114f1d8f08f258e5c1ad2630e74957f872eeefa776f3ed
#define MM_FAMILY_CODE 47
#define MM_FAST 13
#define MM_SLOW 89
#define MM_P1 0.02
#define MM_P2 2.0
#define MM_P3 1.0
#define MM_SL_USD 19.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "d1d421b5ea30a8e63e114f1d8f08f258e5c1ad2630e74957f872eeefa776f3ed"
#define MM_MAGIC 24440405
#define MM_TAG "GOLD10B_MULTI_116"
#include "multimethod_engine.mqh"
