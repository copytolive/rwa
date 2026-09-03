#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s13 p1=1.5 p2=25.0 p3=1.0 off=1.0 exp=7 | hash 793b87a3db50513e00f1d249f87abcdd72966d1c0e1e48437dd1c805a02d4a49
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 13
#define MM_P1 1.5
#define MM_P2 25.0
#define MM_P3 1.0
#define MM_SL_USD 15.5
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "793b87a3db50513e00f1d249f87abcdd72966d1c0e1e48437dd1c805a02d4a49"
#define MM_MAGIC 24444483
#define MM_TAG "GOLD10B_MULTI_098"
#include "multimethod_engine.mqh"
