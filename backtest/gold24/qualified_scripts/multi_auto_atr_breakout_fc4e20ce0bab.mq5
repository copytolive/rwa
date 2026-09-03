#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ATR_BREAKOUT f3/s13 p1=2.2 p2=55.0 p3=1.0 off=4.75 exp=5 | hash fc4e20ce0babcd2a343f39428f8f31ab9672782666835ef0f21fb9a9244f5463
#define MM_FAMILY_CODE 10
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 2.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "fc4e20ce0babcd2a343f39428f8f31ab9672782666835ef0f21fb9a9244f5463"
#define MM_MAGIC 24278638
#define MM_TAG "GOLD10B_MULTI_068"
#include "multimethod_engine.mqh"
