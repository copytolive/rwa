#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55.0 p2=66.0 p3=1.0 off=1.75 exp=6 | hash e7a8917110d62b9beebe338d269ebfc29057cbec1f3a451b15ec485c8ab1a0aa
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_P1 55.0
#define MM_P2 66.0
#define MM_P3 1.0
#define MM_SL_USD 19.0
#define MM_TP_USD 23.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "e7a8917110d62b9beebe338d269ebfc29057cbec1f3a451b15ec485c8ab1a0aa"
#define MM_MAGIC 24284177
#define MM_TAG "GOLD10B_MULTI_081"
#include "multimethod_engine.mqh"
