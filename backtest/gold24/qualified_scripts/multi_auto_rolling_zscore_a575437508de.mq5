#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f34/s89 p1=2.1 p2=55.0 p3=1.0 off=2.0 exp=7 | hash a575437508de07e6c36ad1c3644953c8a40eab6eaa277e3b0206dc9b4ce4aeda
#define MM_FAMILY_CODE 44
#define MM_FAST 34
#define MM_SLOW 89
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 19.0
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "a575437508de07e6c36ad1c3644953c8a40eab6eaa277e3b0206dc9b4ce4aeda"
#define MM_MAGIC 24825621
#define MM_TAG "GOLD10B_MULTI_056"
#include "multimethod_engine.mqh"
