#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s26 p1=0.7 p2=55.0 p3=1.0 off=3.5 exp=12 | hash b23808c8543027d13fef502876c1d83ae1244d72e561f1e9e73c1b8895d25b9d
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 26
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 19.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 3.5
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "b23808c8543027d13fef502876c1d83ae1244d72e561f1e9e73c1b8895d25b9d"
#define MM_MAGIC 24516712
#define MM_TAG "GOLD10B_MULTI_005"
#include "multimethod_engine.mqh"
