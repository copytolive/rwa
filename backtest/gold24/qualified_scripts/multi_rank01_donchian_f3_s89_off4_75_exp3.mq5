#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// DONCHIAN f3/s89 p1=66 p2=55 p3=1 off=4.75 exp=3 | hash 7970caa4ee8c38c0003ccb504ee9f55138c8da747f9021fa71fae9210f088525
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 89
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 3
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090201
#define MM_TAG "GOLD24_MULTI_01"
#include "multimethod_engine.mqh"
