#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f20/s89 p1=2.1 p2=55.0 p3=1.0 off=0.75 exp=8 | hash fb4f54aa1baba0f0281ac4e9c345acbe5f880d0268214759820470ba2f7d939e
#define MM_FAMILY_CODE 44
#define MM_FAST 20
#define MM_SLOW 89
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 17.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "fb4f54aa1baba0f0281ac4e9c345acbe5f880d0268214759820470ba2f7d939e"
#define MM_MAGIC 24380234
#define MM_TAG "GOLD10B_MULTI_062"
#include "multimethod_engine.mqh"
