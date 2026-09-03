#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s20 p1=1.5 p2=40.0 p3=1.0 off=4.5 exp=6 | hash a08b9dcbef20667971fb74fc2b3fcd918d322f81761119ee1a3acf36b47a1f18
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 20
#define MM_P1 1.5
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 17.0
#define MM_TP_USD 17.5
#define MM_OFFSET_USD 4.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "a08b9dcbef20667971fb74fc2b3fcd918d322f81761119ee1a3acf36b47a1f18"
#define MM_MAGIC 24804459
#define MM_TAG "GOLD10B_MULTI_033"
#include "multimethod_engine.mqh"
