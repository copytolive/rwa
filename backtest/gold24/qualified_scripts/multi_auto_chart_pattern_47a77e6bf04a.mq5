#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f3/s55 p1=1.0 p2=55.0 p3=1.0 off=1.75 exp=4 | hash 47a77e6bf04ab4af50ded9840d0de741b4b85113ba2ff7cee4256cb065245a45
#define MM_FAMILY_CODE 3
#define MM_FAST 3
#define MM_SLOW 55
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "47a77e6bf04ab4af50ded9840d0de741b4b85113ba2ff7cee4256cb065245a45"
#define MM_MAGIC 24659211
#define MM_TAG "GOLD10B_MULTI_038"
#include "multimethod_engine.mqh"
