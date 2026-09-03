#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f7/s10 p1=1.05 p2=0.6 p3=1.0 off=1.0 exp=4 | hash 72c8d49b8ab75fb4f302ea12d8c9840f476c733d2cdfbc41990665f3b3a976e6
#define MM_FAMILY_CODE 7
#define MM_FAST 7
#define MM_SLOW 10
#define MM_P1 1.05
#define MM_P2 0.6
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "72c8d49b8ab75fb4f302ea12d8c9840f476c733d2cdfbc41990665f3b3a976e6"
#define MM_MAGIC 24264251
#define MM_TAG "GOLD10B_MULTI_088"
#include "multimethod_engine.mqh"
