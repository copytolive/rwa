#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// CHART_PATTERN f3/s26 p1=0.7 p2=55.0 p3=1.0 off=4.0 exp=3 | hash 22929b50777d39e2cd417bc7c46a4d9b9ac48c58712a24754172ca0697a83931
#define MM_FAMILY_CODE 3
#define MM_FAST 3
#define MM_SLOW 26
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 19.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.0
#define MM_EXPIRY_BARS 3
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "22929b50777d39e2cd417bc7c46a4d9b9ac48c58712a24754172ca0697a83931"
#define MM_MAGIC 24090408
#define MM_TAG "GOLD24_MULTI_08"
#include "multimethod_engine.mqh"
