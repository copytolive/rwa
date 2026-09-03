#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f3/s26 p1=0.7 p2=55.0 p3=1.0 off=3.25 exp=8 | hash 4facf4316f1659f1d0fd3f728dac1e44f06b5c4c0409dcef3156a434a0539cee
#define MM_FAMILY_CODE 3
#define MM_FAST 3
#define MM_SLOW 26
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 17.5
#define MM_TP_USD 19.0
#define MM_OFFSET_USD 3.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "4facf4316f1659f1d0fd3f728dac1e44f06b5c4c0409dcef3156a434a0539cee"
#define MM_MAGIC 24834769
#define MM_TAG "GOLD10B_MULTI_038"
#include "multimethod_engine.mqh"
