#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s21 p1=1.0 p2=55.0 p3=1.0 off=4.25 exp=12 | hash a021fdd7988da89db50529db9644abb9578c7bce2309b8200893bb00593913d5
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "a021fdd7988da89db50529db9644abb9578c7bce2309b8200893bb00593913d5"
#define MM_MAGIC 24282231
#define MM_TAG "GOLD10B_MULTI_051"
#include "multimethod_engine.mqh"
