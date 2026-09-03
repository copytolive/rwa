#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f7/s50 p1=1.7 p2=55.0 p3=1.0 off=2.0 exp=7 | hash ae0f2e70e33eb62e246b84d3c830d8297f545eb7cbb573808a920b846942bb25
#define MM_FAMILY_CODE 44
#define MM_FAST 7
#define MM_SLOW 50
#define MM_P1 1.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "ae0f2e70e33eb62e246b84d3c830d8297f545eb7cbb573808a920b846942bb25"
#define MM_MAGIC 24330512
#define MM_TAG "GOLD10B_MULTI_111"
#include "multimethod_engine.mqh"
