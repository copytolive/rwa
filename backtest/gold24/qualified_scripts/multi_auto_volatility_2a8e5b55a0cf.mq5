#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY f50/s55 p1=1.0 p2=55.0 p3=1.0 off=1.0 exp=8 | hash 2a8e5b55a0cf9f37587bc685cd6bfc57adc381b0ff00c09424425e37b37c62d6
#define MM_FAMILY_CODE 19
#define MM_FAST 50
#define MM_SLOW 55
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "2a8e5b55a0cf9f37587bc685cd6bfc57adc381b0ff00c09424425e37b37c62d6"
#define MM_MAGIC 24472565
#define MM_TAG "GOLD10B_MULTI_108"
#include "multimethod_engine.mqh"
