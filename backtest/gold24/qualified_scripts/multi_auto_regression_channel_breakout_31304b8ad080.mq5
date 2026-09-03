#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// REGRESSION_CHANNEL_BREAKOUT f20/s21 p1=0.05 p2=2.0 p3=1.0 off=1.25 exp=6 | hash 31304b8ad08015e1bbf3a84f12228b02811b8eb9d5eda9f72a88c21d5f8ee3b4
#define MM_FAMILY_CODE 47
#define MM_FAST 20
#define MM_SLOW 21
#define MM_P1 0.05
#define MM_P2 2.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "31304b8ad08015e1bbf3a84f12228b02811b8eb9d5eda9f72a88c21d5f8ee3b4"
#define MM_MAGIC 24548650
#define MM_TAG "GOLD10B_MULTI_117"
#include "multimethod_engine.mqh"
