#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIB_PULLBACK f5/s8 p1=0.382 p2=5.0 p3=1.0 off=2.0 exp=7 | hash 0fe793f15f2d580c87d5a6f2da1c327efed9c9c018ae5ffe1cdb93a2ab5c34bc
#define MM_FAMILY_CODE 39
#define MM_FAST 5
#define MM_SLOW 8
#define MM_P1 0.382
#define MM_P2 5.0
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "0fe793f15f2d580c87d5a6f2da1c327efed9c9c018ae5ffe1cdb93a2ab5c34bc"
#define MM_MAGIC 24534929
#define MM_TAG "GOLD10B_MULTI_018"
#include "multimethod_engine.mqh"
