#property strict
#property version "2.10"
#property description "GOLD24 Multi-Method canonical translation"
// BOLLINGER_REVERSION_V2 f3/s14 p1=1.5 p2=30 p3=1 off=1.25 exp=4 | hash 5b32ea7bda5439f27bc176bed6866ff72c74a109e0e7d51170a205d580017a81
#define MM_FAMILY_CODE 5
#define MM_FAST 3
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 30.0
#define MM_P3 1.0
#define MM_SL_USD 21.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "5b32ea7bda5439f27bc176bed6866ff72c74a109e0e7d51170a205d580017a81"
#define MM_MAGIC 24090303
#define MM_TAG "GOLD24_MULTI_BOLLV2"
#include "multimethod_engine.mqh"
