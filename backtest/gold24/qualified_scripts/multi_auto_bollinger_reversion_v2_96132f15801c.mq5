#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f3/s13 p1=1.5 p2=30.0 p3=1.0 off=1.5 exp=12 | hash 96132f15801c09aa42d8a509e82d52c11f61c5cbc10f4f8d1c45a64c49f8ef50
#define MM_FAMILY_CODE 5
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 1.5
#define MM_P2 30.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "96132f15801c09aa42d8a509e82d52c11f61c5cbc10f4f8d1c45a64c49f8ef50"
#define MM_MAGIC 24339637
#define MM_TAG "GOLD10B_MULTI_009"
#include "multimethod_engine.mqh"
