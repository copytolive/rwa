#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// TREND_EMA f55/s144 p1=66.0 p2=52.0 p3=1.0 off=5.0 exp=9 | hash 8d5841e06d54fc4d702e00d0b8b5e407d2ed2ab351fd56470968fd6bb526ffa2
#define MM_FAMILY_CODE 8
#define MM_FAST 55
#define MM_SLOW 144
#define MM_P1 66.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "8d5841e06d54fc4d702e00d0b8b5e407d2ed2ab351fd56470968fd6bb526ffa2"
#define MM_MAGIC 24271488
#define MM_TAG "GOLD10B_MULTI_070"
#include "multimethod_engine.mqh"
