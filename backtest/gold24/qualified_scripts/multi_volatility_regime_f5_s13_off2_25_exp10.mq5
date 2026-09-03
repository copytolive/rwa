#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// VOLATILITY_REGIME f5/s13 p1=1.2 p2=0.8 p3=1.0 off=2.25 exp=10 | hash 1d77941a57cf39eb393cb22ecf54207970e49fc4075ad95093e5a7188dbfd587
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 13
#define MM_P1 1.2
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 10
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "1d77941a57cf39eb393cb22ecf54207970e49fc4075ad95093e5a7188dbfd587"
#define MM_MAGIC 24090410
#define MM_TAG "GOLD24_MULTI_10"
#include "multimethod_engine.mqh"
