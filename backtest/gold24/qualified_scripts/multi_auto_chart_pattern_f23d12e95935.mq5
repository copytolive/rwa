#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s10 p1=0.5 p2=55.0 p3=1.0 off=1.25 exp=3 | hash f23d12e95935bbccb64b50925058a0e251df137d9a30dd4c60e3fd2f4ef4e743
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 10
#define MM_P1 0.5
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 3
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "f23d12e95935bbccb64b50925058a0e251df137d9a30dd4c60e3fd2f4ef4e743"
#define MM_MAGIC 24188809
#define MM_TAG "GOLD10B_MULTI_015"
#include "multimethod_engine.mqh"
