#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIBONACCI f8/s14 p1=0.786 p2=3.0 p3=1.0 off=1.75 exp=10 | hash c349e409c04ad67455af7432a360e0ae79cc247f9bf650cea88b2e980a720743
#define MM_FAMILY_CODE 18
#define MM_FAST 8
#define MM_SLOW 14
#define MM_P1 0.786
#define MM_P2 3.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 10
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "c349e409c04ad67455af7432a360e0ae79cc247f9bf650cea88b2e980a720743"
#define MM_MAGIC 24499625
#define MM_TAG "GOLD10B_MULTI_100"
#include "multimethod_engine.mqh"
