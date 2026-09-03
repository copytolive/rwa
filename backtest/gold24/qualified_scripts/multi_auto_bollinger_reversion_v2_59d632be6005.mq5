#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f7/s14 p1=1.5 p2=30.0 p3=1.0 off=4.75 exp=5 | hash 59d632be600589a90fe0a2a5fec7d34655bea502b13cb5faee8bc2e26e51684b
#define MM_FAMILY_CODE 5
#define MM_FAST 7
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 30.0
#define MM_P3 1.0
#define MM_SL_USD 16.5
#define MM_TP_USD 17.0
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "59d632be600589a90fe0a2a5fec7d34655bea502b13cb5faee8bc2e26e51684b"
#define MM_MAGIC 24109918
#define MM_TAG "GOLD10B_MULTI_072"
#include "multimethod_engine.mqh"
