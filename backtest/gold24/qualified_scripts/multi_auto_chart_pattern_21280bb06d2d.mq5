#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s10 p1=0.5 p2=55.0 p3=1.0 off=1.0 exp=2 | hash 21280bb06d2d624ef280845d193e18a75f087523a14f16d2becfed1a0b6ca58f
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 10
#define MM_P1 0.5
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 2
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "21280bb06d2d624ef280845d193e18a75f087523a14f16d2becfed1a0b6ca58f"
#define MM_MAGIC 24372560
#define MM_TAG "GOLD10B_MULTI_055"
#include "multimethod_engine.mqh"
