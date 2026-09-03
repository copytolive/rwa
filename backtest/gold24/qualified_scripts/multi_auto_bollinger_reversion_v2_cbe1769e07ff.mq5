#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s21 p1=1.5 p2=35.0 p3=1.0 off=0.5 exp=6 | hash cbe1769e07ff552dc912b4ab7f006f5f274996a71b98b92dea30b73a492b6bbd
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 1.5
#define MM_P2 35.0
#define MM_P3 1.0
#define MM_SL_USD 18.0
#define MM_TP_USD 18.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "cbe1769e07ff552dc912b4ab7f006f5f274996a71b98b92dea30b73a492b6bbd"
#define MM_MAGIC 24650814
#define MM_TAG "GOLD10B_MULTI_011"
#include "multimethod_engine.mqh"
