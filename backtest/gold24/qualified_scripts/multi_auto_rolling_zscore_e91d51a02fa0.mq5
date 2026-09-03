#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f13/s89 p1=2.1 p2=55.0 p3=1.0 off=1.0 exp=6 | hash e91d51a02fa0fbe48dbf3b4a70d27e2d6907a79574171740f28e3b7b2114e6c2
#define MM_FAMILY_CODE 44
#define MM_FAST 13
#define MM_SLOW 89
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 20.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "e91d51a02fa0fbe48dbf3b4a70d27e2d6907a79574171740f28e3b7b2114e6c2"
#define MM_MAGIC 24712768
#define MM_TAG "GOLD10B_MULTI_046"
#include "multimethod_engine.mqh"
