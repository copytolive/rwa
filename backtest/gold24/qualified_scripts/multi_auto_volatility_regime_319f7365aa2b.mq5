#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s7 p1=1.05 p2=0.6 p3=1.0 off=4.25 exp=12 | hash 319f7365aa2b458a59b654498db4b07de0a7b3ea58a6ac97f75894d9b9896b21
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 7
#define MM_P1 1.05
#define MM_P2 0.6
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "319f7365aa2b458a59b654498db4b07de0a7b3ea58a6ac97f75894d9b9896b21"
#define MM_MAGIC 24633349
#define MM_TAG "GOLD10B_MULTI_040"
#include "multimethod_engine.mqh"
