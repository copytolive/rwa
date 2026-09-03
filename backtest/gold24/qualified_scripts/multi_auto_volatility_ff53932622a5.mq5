#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY f5/s100 p1=1.2 p2=55.0 p3=1.0 off=2.25 exp=7 | hash ff53932622a511321dbccb1394479e917013059fd2528ea9b151671e104a86b5
#define MM_FAMILY_CODE 19
#define MM_FAST 5
#define MM_SLOW 100
#define MM_P1 1.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "ff53932622a511321dbccb1394479e917013059fd2528ea9b151671e104a86b5"
#define MM_MAGIC 24567238
#define MM_TAG "GOLD10B_MULTI_027"
#include "multimethod_engine.mqh"
