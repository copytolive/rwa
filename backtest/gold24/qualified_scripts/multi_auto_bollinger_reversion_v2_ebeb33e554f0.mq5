#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s21 p1=1.5 p2=40.0 p3=1.0 off=1.0 exp=12 | hash ebeb33e554f0360ce51bb9dbc6388a4fadd50fc52f57580a16e871e893ab8ba5
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 1.5
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "STOP"
#define MM_CONFIG_HASH "ebeb33e554f0360ce51bb9dbc6388a4fadd50fc52f57580a16e871e893ab8ba5"
#define MM_MAGIC 24560005
#define MM_TAG "GOLD10B_MULTI_065"
#include "multimethod_engine.mqh"
