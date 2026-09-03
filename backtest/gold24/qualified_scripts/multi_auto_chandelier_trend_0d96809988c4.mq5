#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHANDELIER_TREND f3/s34 p1=1.5 p2=55.0 p3=1.0 off=3.75 exp=8 | hash 0d96809988c4a516e3a5470a3c333fcb1c4fe63d3af5985b2513ca360d8ca216
#define MM_FAMILY_CODE 43
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 1.5
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 3.75
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "0d96809988c4a516e3a5470a3c333fcb1c4fe63d3af5985b2513ca360d8ca216"
#define MM_MAGIC 24867129
#define MM_TAG "GOLD10B_MULTI_024"
#include "multimethod_engine.mqh"
