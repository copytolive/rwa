#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIB_PULLBACK f3/s5 p1=0.382 p2=5.0 p3=1.0 off=1.0 exp=9 | hash 020e3c510250050b4212525c6ddea49393f0669748c85d591f7e67920a73c4b8
#define MM_FAMILY_CODE 39
#define MM_FAST 3
#define MM_SLOW 5
#define MM_P1 0.382
#define MM_P2 5.0
#define MM_P3 1.0
#define MM_SL_USD 20.0
#define MM_TP_USD 21.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "020e3c510250050b4212525c6ddea49393f0669748c85d591f7e67920a73c4b8"
#define MM_MAGIC 24187377
#define MM_TAG "GOLD10B_MULTI_071"
#include "multimethod_engine.mqh"
