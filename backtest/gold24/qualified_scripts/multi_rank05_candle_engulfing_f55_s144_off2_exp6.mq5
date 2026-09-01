#property strict
#property version "2.10"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f55/s144 p1=58 p2=62 p3=1 off=2 exp=6 | hash e02f67ebcfefeb1fef8ec5a73e7a0f25c3a4878cd597b9a2a23ea8e12899e2a6
#define MM_FAMILY_CODE 2
#define MM_FAST 55
#define MM_SLOW 144
#define MM_SL_USD 18.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090205
#define MM_TAG "GOLD24_MULTI_05"
#include "multimethod_engine.mqh"
