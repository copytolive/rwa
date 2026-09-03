#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s21 p1=0.7 p2=55.0 p3=1.0 off=4.25 exp=6 | hash 2b75f3d437af4ca75cf3467448e2eb2c2149afc1c77ec8fc70caf2c7be322baa
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 21
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 20.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "2b75f3d437af4ca75cf3467448e2eb2c2149afc1c77ec8fc70caf2c7be322baa"
#define MM_MAGIC 24450420
#define MM_TAG "GOLD10B_MULTI_004"
#include "multimethod_engine.mqh"
