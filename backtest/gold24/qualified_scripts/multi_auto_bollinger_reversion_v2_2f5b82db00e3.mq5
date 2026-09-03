#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s14 p1=1.5 p2=25.0 p3=1.0 off=0.75 exp=9 | hash 2f5b82db00e32bad6ee43435f9e93a7e24863007a1981bfbcf4b30d7fcfd9d3b
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 25.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 20.0
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "2f5b82db00e32bad6ee43435f9e93a7e24863007a1981bfbcf4b30d7fcfd9d3b"
#define MM_MAGIC 24226427
#define MM_TAG "GOLD10B_MULTI_028"
#include "multimethod_engine.mqh"
