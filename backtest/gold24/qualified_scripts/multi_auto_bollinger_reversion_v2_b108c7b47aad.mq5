#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s20 p1=2.0 p2=35.0 p3=1.0 off=1.25 exp=6 | hash b108c7b47aad301100275000958a90f913dfa159c35b59aaa5208735e0803860
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 20
#define MM_P1 2.0
#define MM_P2 35.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "b108c7b47aad301100275000958a90f913dfa159c35b59aaa5208735e0803860"
#define MM_MAGIC 24642644
#define MM_TAG "GOLD10B_MULTI_105"
#include "multimethod_engine.mqh"
