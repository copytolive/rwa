#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// KELTNER_SQUEEZE f50/s89 p1=0.9 p2=1.0 p3=1.0 off=1.5 exp=8 | hash 51ecdce7cf20c9e7917438e5463abfc44a7037eed9ca7ed065ee3c1cbff89848
#define MM_FAMILY_CODE 35
#define MM_FAST 50
#define MM_SLOW 89
#define MM_P1 0.9
#define MM_P2 1.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 18.0
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "51ecdce7cf20c9e7917438e5463abfc44a7037eed9ca7ed065ee3c1cbff89848"
#define MM_MAGIC 24177543
#define MM_TAG "GOLD10B_MULTI_063"
#include "multimethod_engine.mqh"
