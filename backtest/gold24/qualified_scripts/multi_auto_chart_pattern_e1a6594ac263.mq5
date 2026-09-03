#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f10/s21 p1=1.0 p2=55.0 p3=1.0 off=4.75 exp=9 | hash e1a6594ac26351bfce971046f546a2741711042fc21d5429ba03392758321538
#define MM_FAMILY_CODE 3
#define MM_FAST 10
#define MM_SLOW 21
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 18.5
#define MM_TP_USD 22.0
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "e1a6594ac26351bfce971046f546a2741711042fc21d5429ba03392758321538"
#define MM_MAGIC 24275434
#define MM_TAG "GOLD10B_MULTI_040"
#include "multimethod_engine.mqh"
