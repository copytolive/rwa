#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CANDLE_ENGULFING f21/s144 p1=66.0 p2=55.0 p3=1.0 off=3.75 exp=11 | hash ae36b999eb8e29ee9caf6ea8735c52033884e9ea504b0151368aa28173115166
#define MM_FAMILY_CODE 2
#define MM_FAST 21
#define MM_SLOW 144
#define MM_P1 66.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 3.75
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "ae36b999eb8e29ee9caf6ea8735c52033884e9ea504b0151368aa28173115166"
#define MM_MAGIC 24522041
#define MM_TAG "GOLD10B_MULTI_099"
#include "multimethod_engine.mqh"
