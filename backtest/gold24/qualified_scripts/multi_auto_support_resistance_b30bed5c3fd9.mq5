#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s34 p1=1.0 p2=55.0 p3=1.0 off=1.5 exp=9 | hash b30bed5c3fd92d94396a42b0b4b7820ab5dfb4680fc9f8e9ae7d71f50740d0e2
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 20.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "b30bed5c3fd92d94396a42b0b4b7820ab5dfb4680fc9f8e9ae7d71f50740d0e2"
#define MM_MAGIC 24803324
#define MM_TAG "GOLD10B_MULTI_007"
#include "multimethod_engine.mqh"
