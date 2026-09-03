#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f3/s100 p1=62.0 p2=55.0 p3=1.0 off=0.75 exp=11 | hash 4c174439c0c7ea5631baf671697362f6a11dfa6db5cfe0e16d45ead3f4030e05
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 62.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "4c174439c0c7ea5631baf671697362f6a11dfa6db5cfe0e16d45ead3f4030e05"
#define MM_MAGIC 24693209
#define MM_TAG "GOLD10B_MULTI_095"
#include "multimethod_engine.mqh"
