#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f14/s89 p1=66.0 p2=66.0 p3=1.0 off=1.5 exp=4 | hash 7a4f531c532ec4fd3dba6be278cb8f840b1df7ebf92ca84ac85e2bb2b16f51ae
#define MM_FAMILY_CODE 1
#define MM_FAST 14
#define MM_SLOW 89
#define MM_P1 66.0
#define MM_P2 66.0
#define MM_P3 1.0
#define MM_SL_USD 22.0
#define MM_TP_USD 23.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7a4f531c532ec4fd3dba6be278cb8f840b1df7ebf92ca84ac85e2bb2b16f51ae"
#define MM_MAGIC 24118972
#define MM_TAG "GOLD10B_MULTI_087"
#include "multimethod_engine.mqh"
