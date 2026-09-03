#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55.0 p2=52.0 p3=1.0 off=1.75 exp=9 | hash cfd47dec93b09e11ede41b3d31ecbc385e18755869271e3c160dfa1e1dbb7135
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_P1 55.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 22.5
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "cfd47dec93b09e11ede41b3d31ecbc385e18755869271e3c160dfa1e1dbb7135"
#define MM_MAGIC 24509580
#define MM_TAG "GOLD10B_MULTI_084"
#include "multimethod_engine.mqh"
