#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s26 p1=1.1 p2=0.6 p3=1.0 off=2.25 exp=4 | hash 2f713e201c73b2ff7d1b68a698ac8bec1f69e6512477c655a88c5a1e7ce889ef
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 26
#define MM_P1 1.1
#define MM_P2 0.6
#define MM_P3 1.0
#define MM_SL_USD 19.0
#define MM_TP_USD 23.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "2f713e201c73b2ff7d1b68a698ac8bec1f69e6512477c655a88c5a1e7ce889ef"
#define MM_MAGIC 24850624
#define MM_TAG "GOLD10B_MULTI_112"
#include "multimethod_engine.mqh"
