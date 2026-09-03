#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s21 p1=1.5 p2=40.0 p3=1.0 off=2.75 exp=12 | hash 76a9e2f74712808d5039e41d5f277e4fede73d05f68371f3dcf4b141adf77da0
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 1.5
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 21.0
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 2.75
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "76a9e2f74712808d5039e41d5f277e4fede73d05f68371f3dcf4b141adf77da0"
#define MM_MAGIC 24545175
#define MM_TAG "GOLD10B_MULTI_102"
#include "multimethod_engine.mqh"
