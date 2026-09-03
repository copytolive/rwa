#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// VOLATILITY_REGIME f5/s7 p1=1.1 p2=0.8 p3=1.0 off=0.5 exp=2 | hash aa120bcd581bc34cb29382a46a1a39b51ccf83476f639c4cf178926701577dd3
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 7
#define MM_P1 1.1
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 22.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 2
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "aa120bcd581bc34cb29382a46a1a39b51ccf83476f639c4cf178926701577dd3"
#define MM_MAGIC 24090412
#define MM_TAG "GOLD24_MULTI_12"
#include "multimethod_engine.mqh"
