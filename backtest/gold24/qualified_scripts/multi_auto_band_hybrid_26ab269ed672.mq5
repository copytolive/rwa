#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BAND_HYBRID f14/s34 p1=2.0 p2=1.5 p3=1.0 off=1.5 exp=8 | hash 26ab269ed672528c55077095a1e0e80ddea303d89378b7993905de2e66aa85a9
#define MM_FAMILY_CODE 20
#define MM_FAST 14
#define MM_SLOW 34
#define MM_P1 2.0
#define MM_P2 1.5
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "26ab269ed672528c55077095a1e0e80ddea303d89378b7993905de2e66aa85a9"
#define MM_MAGIC 24850750
#define MM_TAG "GOLD10B_MULTI_025"
#include "multimethod_engine.mqh"
