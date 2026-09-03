#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s21 p1=0.7 p2=55.0 p3=1.0 off=3.0 exp=12 | hash fa16e61b3d3207ef135a61a394ce0e7e1f6ab82855c128876f06339363f3273f
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 18.0
#define MM_TP_USD 19.5
#define MM_OFFSET_USD 3.0
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "fa16e61b3d3207ef135a61a394ce0e7e1f6ab82855c128876f06339363f3273f"
#define MM_MAGIC 24704699
#define MM_TAG "GOLD10B_MULTI_075"
#include "multimethod_engine.mqh"
