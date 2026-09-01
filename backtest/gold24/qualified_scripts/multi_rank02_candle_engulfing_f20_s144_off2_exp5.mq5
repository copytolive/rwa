#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f20/s144 p1=52 p2=62 p3=1 off=2 exp=5 | hash da946a87a6319b754c9f42b97a34e5954ca5a731e56e3964c762a9c9cc9ec1d1
#define MM_FAMILY_CODE 2
#define MM_FAST 20
#define MM_SLOW 144
#define MM_SL_USD 24.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090202
#define MM_TAG "GOLD24_MULTI_02"
#include "multimethod_engine.mqh"
