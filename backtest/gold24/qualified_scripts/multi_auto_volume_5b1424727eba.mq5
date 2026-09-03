#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLUME f5/s144 p1=1.4 p2=55.0 p3=1.0 off=1.5 exp=7 | hash 5b1424727eba7691c6234324b5928768a63b1dfe628311aa093b2542de98c2ed
#define MM_FAMILY_CODE 6
#define MM_FAST 5
#define MM_SLOW 144
#define MM_P1 1.4
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "5b1424727eba7691c6234324b5928768a63b1dfe628311aa093b2542de98c2ed"
#define MM_MAGIC 24146706
#define MM_TAG "GOLD10B_MULTI_021"
#include "multimethod_engine.mqh"
