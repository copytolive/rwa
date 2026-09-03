#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s26 p1=1.8 p2=40.0 p3=1.0 off=0.5 exp=6 | hash df97f07820361e30fd7b7ce8781c171c3ae626450603a4fb19fa693b7021d7f1
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 26
#define MM_P1 1.8
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 19.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "df97f07820361e30fd7b7ce8781c171c3ae626450603a4fb19fa693b7021d7f1"
#define MM_MAGIC 24176664
#define MM_TAG "GOLD10B_MULTI_058"
#include "multimethod_engine.mqh"
