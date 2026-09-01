#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f100/s144 p1=66 p2=52 p3=1 off=5 exp=4 | hash 19b16bbde8f2edb8f9ab7a699cf228e3d6d1f2b47ca32ac0aed6408cae7caefc
#define MM_FAMILY_CODE 2
#define MM_FAST 100
#define MM_SLOW 144
#define MM_SL_USD 21.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090202
#define MM_TAG "GOLD24_MULTI_02"
#include "multimethod_engine.mqh"
