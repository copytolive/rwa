#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s34 p1=1.3 p2=0.8 p3=1.0 off=1.25 exp=8 | hash eabd6974b979cad0d65bb5084c4612036eb2272e703c6156f514a28e33a188a2
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 34
#define MM_P1 1.3
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 15.0
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "eabd6974b979cad0d65bb5084c4612036eb2272e703c6156f514a28e33a188a2"
#define MM_MAGIC 24781844
#define MM_TAG "GOLD10B_MULTI_082"
#include "multimethod_engine.mqh"
