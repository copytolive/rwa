#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f26/s144 p1=55 p2=66 p3=1 off=2 exp=8 | hash 8dbd1e4d7bec3dfa380e99e73de4e9d0b149b449016ba193972c3a6b92b36701
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_SL_USD 20.5
#define MM_TP_USD 20.5
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090203
#define MM_TAG "GOLD24_MULTI_03"
#include "multimethod_engine.mqh"
