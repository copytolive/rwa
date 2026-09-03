#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f3/s100 p1=55.0 p2=58.0 p3=1.0 off=2.5 exp=8 | hash 9e9e0c4317a723ea457f7747128f737625422aaf88d40463f31b5cbfbb8bc990
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 55.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "9e9e0c4317a723ea457f7747128f737625422aaf88d40463f31b5cbfbb8bc990"
#define MM_MAGIC 24457955
#define MM_TAG "GOLD10B_MULTI_032"
#include "multimethod_engine.mqh"
