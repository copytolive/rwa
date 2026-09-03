#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY f3/s8 p1=1.2 p2=55.0 p3=1.0 off=1.5 exp=11 | hash 30089110db75e701c01f4af7b023f107750fa74259b28347c0abee273102f94d
#define MM_FAMILY_CODE 19
#define MM_FAST 3
#define MM_SLOW 8
#define MM_P1 1.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "30089110db75e701c01f4af7b023f107750fa74259b28347c0abee273102f94d"
#define MM_MAGIC 24367792
#define MM_TAG "GOLD10B_MULTI_067"
#include "multimethod_engine.mqh"
