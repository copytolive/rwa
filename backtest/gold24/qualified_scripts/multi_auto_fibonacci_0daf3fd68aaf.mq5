#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIBONACCI f13/s20 p1=0.786 p2=5.0 p3=1.0 off=1.25 exp=12 | hash 0daf3fd68aaf0c76529a7ca4f42b694fc4757a6fd9a05a80ba884ac2c08aa988
#define MM_FAMILY_CODE 18
#define MM_FAST 13
#define MM_SLOW 20
#define MM_P1 0.786
#define MM_P2 5.0
#define MM_P3 1.0
#define MM_SL_USD 17.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "0daf3fd68aaf0c76529a7ca4f42b694fc4757a6fd9a05a80ba884ac2c08aa988"
#define MM_MAGIC 24888950
#define MM_TAG "GOLD10B_MULTI_091"
#include "multimethod_engine.mqh"
