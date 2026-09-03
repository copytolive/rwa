#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ATR_BREAKOUT f3/s13 p1=2.2 p2=55.0 p3=1.0 off=4.5 exp=7 | hash d4120b602b6f750a311b71fc9fd70c59df9c3428fe0df061d43b2584ab728bc1
#define MM_FAMILY_CODE 10
#define MM_FAST 3
#define MM_SLOW 13
#define MM_P1 2.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.5
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "d4120b602b6f750a311b71fc9fd70c59df9c3428fe0df061d43b2584ab728bc1"
#define MM_MAGIC 24452352
#define MM_TAG "GOLD10B_MULTI_045"
#include "multimethod_engine.mqh"
