#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f3/s89 p1=66.0 p2=52.0 p3=1.0 off=2.25 exp=7 | hash 858d1a72df1e887393300307668dc955ac15db05a1f1ec3bfdb821f12312cd35
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 89
#define MM_P1 66.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_SL_USD 16.5
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "858d1a72df1e887393300307668dc955ac15db05a1f1ec3bfdb821f12312cd35"
#define MM_MAGIC 24717074
#define MM_TAG "GOLD10B_MULTI_076"
#include "multimethod_engine.mqh"
