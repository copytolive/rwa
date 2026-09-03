#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s20 p1=1.5 p2=40.0 p3=1.0 off=1.25 exp=7 | hash a12551392aea7b1d0bb0f7fa2812ca2ea5d5cd99d43c223ab57834a2326ed8fc
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 20
#define MM_P1 1.5
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 16.5
#define MM_TP_USD 23.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "a12551392aea7b1d0bb0f7fa2812ca2ea5d5cd99d43c223ab57834a2326ed8fc"
#define MM_MAGIC 24477401
#define MM_TAG "GOLD10B_MULTI_026"
#include "multimethod_engine.mqh"
