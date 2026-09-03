#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s21 p1=1.8 p2=35.0 p3=1.0 off=1.5 exp=5 | hash 80eaeba7b3e3dd31d13040f98dddf53516be512a046212b9dc1b3f7b6649e6f5
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 1.8
#define MM_P2 35.0
#define MM_P3 1.0
#define MM_SL_USD 20.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "80eaeba7b3e3dd31d13040f98dddf53516be512a046212b9dc1b3f7b6649e6f5"
#define MM_MAGIC 24579399
#define MM_TAG "GOLD10B_MULTI_074"
#include "multimethod_engine.mqh"
