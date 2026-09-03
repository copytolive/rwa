#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// MARKET_STRUCTURE f13/s144 p1=66.0 p2=62.0 p3=1.0 off=1.5 exp=4 | hash 17760e71d4327ee8d29d669f9337715dcec71a2dd9a2399b31750aac4d87a35e
#define MM_FAMILY_CODE 16
#define MM_FAST 13
#define MM_SLOW 144
#define MM_P1 66.0
#define MM_P2 62.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "17760e71d4327ee8d29d669f9337715dcec71a2dd9a2399b31750aac4d87a35e"
#define MM_MAGIC 24112913
#define MM_TAG "GOLD10B_MULTI_043"
#include "multimethod_engine.mqh"
