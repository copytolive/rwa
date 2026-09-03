#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// PRICE_STRUCTURE f8/s100 p1=58.0 p2=58.0 p3=1.0 off=1.5 exp=10 | hash 41e7b79028cc2ae138c26e2a1fcc2e4fd8f31715c94dacdf78ea3bbf2dd3ec93
#define MM_FAMILY_CODE 13
#define MM_FAST 8
#define MM_SLOW 100
#define MM_P1 58.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_SL_USD 15.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 10
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "41e7b79028cc2ae138c26e2a1fcc2e4fd8f31715c94dacdf78ea3bbf2dd3ec93"
#define MM_MAGIC 24204848
#define MM_TAG "GOLD10B_MULTI_046"
#include "multimethod_engine.mqh"
