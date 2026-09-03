#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f3/s20 p1=1.3 p2=0.8 p3=1.0 off=1.5 exp=7 | hash 173c00588932ed4d755e7a69964bb17a1a750c3929595bc461e9183e9ef95885
#define MM_FAMILY_CODE 7
#define MM_FAST 3
#define MM_SLOW 20
#define MM_P1 1.3
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "173c00588932ed4d755e7a69964bb17a1a750c3929595bc461e9183e9ef95885"
#define MM_MAGIC 24308216
#define MM_TAG "GOLD10B_MULTI_017"
#include "multimethod_engine.mqh"
