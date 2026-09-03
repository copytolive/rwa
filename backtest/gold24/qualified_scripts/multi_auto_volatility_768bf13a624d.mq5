#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY f3/s13 p1=1.2 p2=55.0 p3=1.0 off=2.0 exp=11 | hash 768bf13a624db8c64c72d4fdc5db08b68c9cbb9372a67d8bfa83d598e82d73c8
#define MM_FAMILY_CODE 19
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 1.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "768bf13a624db8c64c72d4fdc5db08b68c9cbb9372a67d8bfa83d598e82d73c8"
#define MM_MAGIC 24182746
#define MM_TAG "GOLD10B_MULTI_021"
#include "multimethod_engine.mqh"
