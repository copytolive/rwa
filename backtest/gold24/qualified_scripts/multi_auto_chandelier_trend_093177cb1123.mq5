#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHANDELIER_TREND f10/s144 p1=1.5 p2=55.0 p3=1.0 off=4.0 exp=8 | hash 093177cb1123d5b3caf89cad2b213c2d1d4b5898e561b831629d8c746c849fb7
#define MM_FAMILY_CODE 43
#define MM_FAST 10
#define MM_SLOW 144
#define MM_P1 1.5
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "093177cb1123d5b3caf89cad2b213c2d1d4b5898e561b831629d8c746c849fb7"
#define MM_MAGIC 24736875
#define MM_TAG "GOLD10B_MULTI_090"
#include "multimethod_engine.mqh"
