#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f3/s89 p1=2.1 p2=55.0 p3=1.0 off=2.5 exp=12 | hash e453d878e0676b0147edccd06a03f560320421713d67cb32093f6402f911c889
#define MM_FAMILY_CODE 44
#define MM_FAST 3
#define MM_SLOW 89
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 15.0
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "e453d878e0676b0147edccd06a03f560320421713d67cb32093f6402f911c889"
#define MM_MAGIC 24400152
#define MM_TAG "GOLD10B_MULTI_069"
#include "multimethod_engine.mqh"
