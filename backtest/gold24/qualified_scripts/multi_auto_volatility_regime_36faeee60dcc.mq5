#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s10 p1=1.1 p2=0.6 p3=1.0 off=4.5 exp=2 | hash 36faeee60dcc0a98f2215629f59d4620ce52285ca2b4d926cda478cfa10e81c5
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 10
#define MM_P1 1.1
#define MM_P2 0.6
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 22.5
#define MM_OFFSET_USD 4.5
#define MM_EXPIRY_BARS 2
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "36faeee60dcc0a98f2215629f59d4620ce52285ca2b4d926cda478cfa10e81c5"
#define MM_MAGIC 24114822
#define MM_TAG "GOLD10B_MULTI_023"
#include "multimethod_engine.mqh"
