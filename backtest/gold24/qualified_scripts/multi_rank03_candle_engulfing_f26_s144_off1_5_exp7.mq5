#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55 p2=52 p3=1 off=1.5 exp=7 | hash f6ad687ae3a4d69df50d2ebb647bb7e2cf506eaa0ed4209b582f8cc8b4e1cc20
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_SL_USD 21.0
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090203
#define MM_TAG "GOLD24_MULTI_03"
#include "multimethod_engine.mqh"
