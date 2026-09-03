#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// BOLLINGER_REVERSION_V2 f8/s13 p1=1.5 p2=30.0 p3=1.0 off=0.5 exp=5 | hash 0b27901d1ce62559b1b7efa0c30bf8005edf5addd2b68d398b2d8b6a34eb09c6
#define MM_FAMILY_CODE 5
#define MM_FAST 8
#define MM_SLOW 13
#define MM_P1 1.5
#define MM_P2 30.0
#define MM_P3 1.0
#define MM_SL_USD 19.0
#define MM_TP_USD 18.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "0b27901d1ce62559b1b7efa0c30bf8005edf5addd2b68d398b2d8b6a34eb09c6"
#define MM_MAGIC 24090407
#define MM_TAG "GOLD24_MULTI_07"
#include "multimethod_engine.mqh"
