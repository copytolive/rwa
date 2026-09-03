#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f8/s21 p1=2.0 p2=40.0 p3=1.0 off=2.25 exp=6 | hash 6c50adf7ead2752fbe74fa2d374ac47db3aaa6168273222c9ce93d14cadec6bf
#define MM_FAMILY_CODE 5
#define MM_FAST 8
#define MM_SLOW 21
#define MM_P1 2.0
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 17.0
#define MM_TP_USD 20.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "6c50adf7ead2752fbe74fa2d374ac47db3aaa6168273222c9ce93d14cadec6bf"
#define MM_MAGIC 24526743
#define MM_TAG "GOLD10B_MULTI_031"
#include "multimethod_engine.mqh"
