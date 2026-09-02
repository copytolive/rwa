#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CHART_PATTERN f3/s34 p1=0.7 p2=55 p3=1 off=1.25 exp=8 | hash 4ff55b7bfa26f3cd3778faa661704fa1b1ed2e7767a249e5eab593352ca1b514
#define MM_FAMILY_CODE 3
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090301
#define MM_TAG "GOLD24_MULTI_CHART"
#include "multimethod_engine.mqh"
