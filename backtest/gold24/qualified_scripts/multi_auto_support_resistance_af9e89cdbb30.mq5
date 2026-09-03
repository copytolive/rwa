#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s34 p1=1.0 p2=55.0 p3=1.0 off=4.75 exp=6 | hash af9e89cdbb3036c2e5e7732cf1c8a71dbc9fcee3ef4559bcac310441f82d4b6a
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 15.0
#define MM_TP_USD 22.5
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "af9e89cdbb3036c2e5e7732cf1c8a71dbc9fcee3ef4559bcac310441f82d4b6a"
#define MM_MAGIC 24102765
#define MM_TAG "GOLD10B_MULTI_060"
#include "multimethod_engine.mqh"
