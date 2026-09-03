#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f7/s14 p1=1.5 p2=40.0 p3=1.0 off=1.0 exp=4 | hash 657c7fe3b1612ed4e2e6a9cc5d5da05f6e8407b1cd064c6088175edb575bae2d
#define MM_FAMILY_CODE 5
#define MM_FAST 7
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "657c7fe3b1612ed4e2e6a9cc5d5da05f6e8407b1cd064c6088175edb575bae2d"
#define MM_MAGIC 24358019
#define MM_TAG "GOLD10B_MULTI_048"
#include "multimethod_engine.mqh"
