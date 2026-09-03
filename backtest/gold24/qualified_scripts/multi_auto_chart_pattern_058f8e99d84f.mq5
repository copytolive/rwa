#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f3/s26 p1=0.7 p2=55.0 p3=1.0 off=5.0 exp=7 | hash 058f8e99d84fcff87925844b003f5e28cc361f70fec344f55a6c8c64b232b15b
#define MM_FAMILY_CODE 3
#define MM_FAST 3
#define MM_SLOW 26
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 16.0
#define MM_TP_USD 20.5
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "058f8e99d84fcff87925844b003f5e28cc361f70fec344f55a6c8c64b232b15b"
#define MM_MAGIC 24594233
#define MM_TAG "GOLD10B_MULTI_078"
#include "multimethod_engine.mqh"
