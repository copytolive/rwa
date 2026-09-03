#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// MARKET_STRUCTURE f13/s50 p1=66.0 p2=62.0 p3=1.0 off=4.75 exp=12 | hash 3ed41d12932d82bef7f25bc01ffc2813e570e5181c5d9367e984afd0494b3412
#define MM_FAMILY_CODE 16
#define MM_FAST 13
#define MM_SLOW 50
#define MM_P1 66.0
#define MM_P2 62.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "3ed41d12932d82bef7f25bc01ffc2813e570e5181c5d9367e984afd0494b3412"
#define MM_MAGIC 24588466
#define MM_TAG "GOLD10B_MULTI_041"
#include "multimethod_engine.mqh"
