#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BAND_HYBRID f20/s21 p1=2.0 p2=2.0 p3=1.0 off=0.75 exp=6 | hash 8c2b4f9e83e39e8c4d913973b77a7b118c42b9c0398e8f827d19a05c69ba0adf
#define MM_FAMILY_CODE 20
#define MM_FAST 20
#define MM_SLOW 21
#define MM_P1 2.0
#define MM_P2 2.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "8c2b4f9e83e39e8c4d913973b77a7b118c42b9c0398e8f827d19a05c69ba0adf"
#define MM_MAGIC 24548670
#define MM_TAG "GOLD10B_MULTI_036"
#include "multimethod_engine.mqh"
