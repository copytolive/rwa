#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s14 p1=1.5 p2=25.0 p3=1.0 off=0.5 exp=4 | hash 7ef8a96712bb1fbfe48aae1c932cb47bcc08e293e28343fd928743d159b9e68e
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 25.0
#define MM_P3 1.0
#define MM_SL_USD 19.5
#define MM_TP_USD 23.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7ef8a96712bb1fbfe48aae1c932cb47bcc08e293e28343fd928743d159b9e68e"
#define MM_MAGIC 24725511
#define MM_TAG "GOLD10B_MULTI_023"
#include "multimethod_engine.mqh"
