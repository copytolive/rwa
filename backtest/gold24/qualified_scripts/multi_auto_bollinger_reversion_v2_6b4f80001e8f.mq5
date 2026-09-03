#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f8/s21 p1=1.5 p2=35.0 p3=1.0 off=0.5 exp=4 | hash 6b4f80001e8f825f5a77651dbdb381f9dc1eda19d7a7b66193a22832d3e39751
#define MM_FAMILY_CODE 5
#define MM_FAST 8
#define MM_SLOW 21
#define MM_P1 1.5
#define MM_P2 35.0
#define MM_P3 1.0
#define MM_SL_USD 18.5
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "6b4f80001e8f825f5a77651dbdb381f9dc1eda19d7a7b66193a22832d3e39751"
#define MM_MAGIC 24472224
#define MM_TAG "GOLD10B_MULTI_035"
#include "multimethod_engine.mqh"
