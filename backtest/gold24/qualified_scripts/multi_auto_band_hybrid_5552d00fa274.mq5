#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BAND_HYBRID f21/s26 p1=2.0 p2=1.5 p3=1.0 off=5.0 exp=8 | hash 5552d00fa27463f19cfb80fcaab93cc984dcce6527c53caae06d1c91c137e193
#define MM_FAMILY_CODE 20
#define MM_FAST 21
#define MM_SLOW 26
#define MM_P1 2.0
#define MM_P2 1.5
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "5552d00fa27463f19cfb80fcaab93cc984dcce6527c53caae06d1c91c137e193"
#define MM_MAGIC 24390575
#define MM_TAG "GOLD10B_MULTI_080"
#include "multimethod_engine.mqh"
