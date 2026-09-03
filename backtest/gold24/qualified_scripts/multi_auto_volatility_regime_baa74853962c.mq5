#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f14/s20 p1=1.05 p2=0.9 p3=1.0 off=1.0 exp=7 | hash baa74853962cc3f30213b3e33aa0f5c7bc8216c6c63ba435afdd1515ee96492d
#define MM_FAMILY_CODE 7
#define MM_FAST 14
#define MM_SLOW 20
#define MM_P1 1.05
#define MM_P2 0.9
#define MM_P3 1.0
#define MM_SL_USD 18.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "baa74853962cc3f30213b3e33aa0f5c7bc8216c6c63ba435afdd1515ee96492d"
#define MM_MAGIC 24425203
#define MM_TAG "GOLD10B_MULTI_104"
#include "multimethod_engine.mqh"
