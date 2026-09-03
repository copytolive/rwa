#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f13/s20 p1=1.3 p2=55.0 p3=1.0 off=3.75 exp=12 | hash 02d0dc10d1f5b7a2f1798f1ef77d1f9052578f986b99d5c67162ab221c2d49e5
#define MM_FAMILY_CODE 44
#define MM_FAST 13
#define MM_SLOW 20
#define MM_P1 1.3
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 3.75
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "02d0dc10d1f5b7a2f1798f1ef77d1f9052578f986b99d5c67162ab221c2d49e5"
#define MM_MAGIC 24142256
#define MM_TAG "GOLD10B_MULTI_093"
#include "multimethod_engine.mqh"
