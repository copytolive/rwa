#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f3/s14 p1=1.5 p2=30.0 p3=1.0 off=2.5 exp=11 | hash acd4c2c81c1b1e9a6ea2edba3c9bc0893ecc756035efb01df0a7caf5381af8d9
#define MM_FAMILY_CODE 5
#define MM_FAST 3
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 30.0
#define MM_P3 1.0
#define MM_SL_USD 16.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "acd4c2c81c1b1e9a6ea2edba3c9bc0893ecc756035efb01df0a7caf5381af8d9"
#define MM_MAGIC 24524648
#define MM_TAG "GOLD10B_MULTI_013"
#include "multimethod_engine.mqh"
