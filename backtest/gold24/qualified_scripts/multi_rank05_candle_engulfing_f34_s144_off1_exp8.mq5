#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f34/s144 p1=58 p2=62 p3=1 off=1 exp=8 | hash f5ba0fe1ce860327d35c4e5862e13d5e0d82a0ff84cb308e90c51b9dfac8d69f
#define MM_FAMILY_CODE 2
#define MM_FAST 34
#define MM_SLOW 144
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090205
#define MM_TAG "GOLD24_MULTI_05"
#include "multimethod_engine.mqh"
