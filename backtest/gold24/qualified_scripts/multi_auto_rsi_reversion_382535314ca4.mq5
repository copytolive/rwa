#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// RSI_REVERSION f20/s26 p1=35.0 p2=55.0 p3=1.0 off=4.25 exp=7 | hash 382535314ca4ed32467ca45c8710e91552ee13e9ec52a2b5fda49dc28d87d38f
#define MM_FAMILY_CODE 33
#define MM_FAST 20
#define MM_SLOW 26
#define MM_P1 35.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "382535314ca4ed32467ca45c8710e91552ee13e9ec52a2b5fda49dc28d87d38f"
#define MM_MAGIC 24462545
#define MM_TAG "GOLD10B_MULTI_103"
#include "multimethod_engine.mqh"
