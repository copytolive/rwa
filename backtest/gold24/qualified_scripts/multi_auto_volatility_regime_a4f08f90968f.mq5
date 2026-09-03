#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s8 p1=1.05 p2=0.7 p3=1.0 off=2.25 exp=3 | hash a4f08f90968f132e7d67c32ae158a6bce2cdcbc10264aecd2e43e663fe8d0b23
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 8
#define MM_P1 1.05
#define MM_P2 0.7
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 3
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "a4f08f90968f132e7d67c32ae158a6bce2cdcbc10264aecd2e43e663fe8d0b23"
#define MM_MAGIC 24128816
#define MM_TAG "GOLD10B_MULTI_016"
#include "multimethod_engine.mqh"
