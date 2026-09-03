#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f3/s13 p1=1.2 p2=0.8 p3=1.0 off=2.0 exp=4 | hash 488594394e81159e3039ac1b9a8b39049c5db51f392f3ba324a60668c6d38b4f
#define MM_FAMILY_CODE 7
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 1.2
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 15.0
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "488594394e81159e3039ac1b9a8b39049c5db51f392f3ba324a60668c6d38b4f"
#define MM_MAGIC 24813785
#define MM_TAG "GOLD10B_MULTI_113"
#include "multimethod_engine.mqh"
