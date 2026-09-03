#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIBONACCI f8/s13 p1=0.786 p2=8.0 p3=1.0 off=4.75 exp=12 | hash 65a90f7223f1c474bea6b231c12a368ab54a40067515ee3eb11cada7b64b7b71
#define MM_FAMILY_CODE 18
#define MM_FAST 8
#define MM_SLOW 13
#define MM_P1 0.786
#define MM_P2 8.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "65a90f7223f1c474bea6b231c12a368ab54a40067515ee3eb11cada7b64b7b71"
#define MM_MAGIC 24878354
#define MM_TAG "GOLD10B_MULTI_086"
#include "multimethod_engine.mqh"
