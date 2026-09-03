#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f34/s89 p1=2.1 p2=55.0 p3=1.0 off=4.25 exp=8 | hash 0962c885f4d006281ac9bca4afcdd1856157321ba1ae72e0d4811cd48bfc402f
#define MM_FAMILY_CODE 44
#define MM_FAST 34
#define MM_SLOW 89
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 17.0
#define MM_TP_USD 19.0
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "0962c885f4d006281ac9bca4afcdd1856157321ba1ae72e0d4811cd48bfc402f"
#define MM_MAGIC 24768805
#define MM_TAG "GOLD10B_MULTI_059"
#include "multimethod_engine.mqh"
