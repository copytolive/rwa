#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// PRICE_STRUCTURE f13/s89 p1=52.0 p2=55.0 p3=1.0 off=5.0 exp=11 | hash 7fa716f490efb827027c5c4c0772f5fc1ea5e2a9ce9f9475eb03c6efc1514c4f
#define MM_FAMILY_CODE 13
#define MM_FAST 13
#define MM_SLOW 89
#define MM_P1 52.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7fa716f490efb827027c5c4c0772f5fc1ea5e2a9ce9f9475eb03c6efc1514c4f"
#define MM_MAGIC 24156820
#define MM_TAG "GOLD10B_MULTI_089"
#include "multimethod_engine.mqh"
