#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f3/s13 p1=1.5 p2=30.0 p3=1.0 off=0.75 exp=7 | hash f70d19cd5ba0852d57068d4ff50bf14bc074d1744695485ceb93df52dd624762
#define MM_FAMILY_CODE 5
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 1.5
#define MM_P2 30.0
#define MM_P3 1.0
#define MM_SL_USD 22.0
#define MM_TP_USD 22.5
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "f70d19cd5ba0852d57068d4ff50bf14bc074d1744695485ceb93df52dd624762"
#define MM_MAGIC 24130925
#define MM_TAG "GOLD10B_MULTI_042"
#include "multimethod_engine.mqh"
