#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s21 p1=0.7 p2=55.0 p3=1.0 off=2.25 exp=8 | hash f0781115f863165fffd6bb966835546a8b4938f63aaf68ef38e0d0a63fedc7c2
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 21
#define MM_P1 0.7
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 21.5
#define MM_TP_USD 8.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "f0781115f863165fffd6bb966835546a8b4938f63aaf68ef38e0d0a63fedc7c2"
#define MM_MAGIC 24100533
#define MM_TAG "GOLD10B_MULTI_004"
#include "multimethod_engine.mqh"
