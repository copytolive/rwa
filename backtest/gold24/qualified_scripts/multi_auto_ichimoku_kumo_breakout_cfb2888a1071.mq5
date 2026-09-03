#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ICHIMOKU_KUMO_BREAKOUT f8/s100 p1=0.2 p2=55.0 p3=1.0 off=1.0 exp=9 | hash cfb2888a1071bbcca59cad3c5a3079531f403d773259314e618a5036e7ffe424
#define MM_FAMILY_CODE 40
#define MM_FAST 8
#define MM_SLOW 100
#define MM_P1 0.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 21.5
#define MM_TP_USD 17.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "cfb2888a1071bbcca59cad3c5a3079531f403d773259314e618a5036e7ffe424"
#define MM_MAGIC 24684074
#define MM_TAG "GOLD10B_MULTI_030"
#include "multimethod_engine.mqh"
