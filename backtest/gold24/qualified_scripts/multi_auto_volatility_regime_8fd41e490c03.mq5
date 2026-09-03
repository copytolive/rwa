#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f20/s21 p1=1.5 p2=1.0 p3=1.0 off=2.5 exp=10 | hash 8fd41e490c0355123d4fdf92db9a94b851ba8dcb87345b2eaa3289c4696488b2
#define MM_FAMILY_CODE 7
#define MM_FAST 20
#define MM_SLOW 21
#define MM_P1 1.5
#define MM_P2 1.0
#define MM_P3 1.0
#define MM_SL_USD 24.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 10
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "8fd41e490c0355123d4fdf92db9a94b851ba8dcb87345b2eaa3289c4696488b2"
#define MM_MAGIC 24343273
#define MM_TAG "GOLD10B_MULTI_085"
#include "multimethod_engine.mqh"
