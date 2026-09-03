#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f3/s100 p1=66.0 p2=58.0 p3=1.0 off=1.5 exp=7 | hash 48d038ed63918bfcaf1c9ba625aa8580e7d83baa7419d87a2e57604714d96078
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 66.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "48d038ed63918bfcaf1c9ba625aa8580e7d83baa7419d87a2e57604714d96078"
#define MM_MAGIC 24105613
#define MM_TAG "GOLD10B_MULTI_032"
#include "multimethod_engine.mqh"
