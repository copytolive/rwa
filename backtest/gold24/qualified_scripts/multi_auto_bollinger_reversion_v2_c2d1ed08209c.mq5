#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f13/s20 p1=1.5 p2=40.0 p3=1.0 off=4.25 exp=11 | hash c2d1ed08209c59ae4397020c13922cc83d5f9d268eb2429927b9208e95a80de4
#define MM_FAMILY_CODE 5
#define MM_FAST 13
#define MM_SLOW 20
#define MM_P1 1.5
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "c2d1ed08209c59ae4397020c13922cc83d5f9d268eb2429927b9208e95a80de4"
#define MM_MAGIC 24637608
#define MM_TAG "GOLD10B_MULTI_109"
#include "multimethod_engine.mqh"
