#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f7/s14 p1=1.5 p2=35.0 p3=1.0 off=1.75 exp=2 | hash a41e11472251bd47cc6349edd949afd30aded3deeb2b46818bae5ce508cc49cf
#define MM_FAMILY_CODE 5
#define MM_FAST 7
#define MM_SLOW 14
#define MM_P1 1.5
#define MM_P2 35.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 2
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "a41e11472251bd47cc6349edd949afd30aded3deeb2b46818bae5ce508cc49cf"
#define MM_MAGIC 24733927
#define MM_TAG "GOLD10B_MULTI_044"
#include "multimethod_engine.mqh"
