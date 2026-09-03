#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f3/s100 p1=1.3 p2=0.6 p3=1.0 off=1.25 exp=8 | hash 6779982f53e1496a68cf9f7b9dcba3a221a6e193f332002137616ccdfa4e6e7f
#define MM_FAMILY_CODE 7
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 1.3
#define MM_P2 0.6
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "6779982f53e1496a68cf9f7b9dcba3a221a6e193f332002137616ccdfa4e6e7f"
#define MM_MAGIC 24122063
#define MM_TAG "GOLD10B_MULTI_073"
#include "multimethod_engine.mqh"
