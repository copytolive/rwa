#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f26/s144 p1=58 p2=58 p3=1 off=2.75 exp=7 | hash 4b9f29a975f601fdef05a83c4ebffb861e6bc3c34e318a8e879b7e17940131f1
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 26
#define MM_SLOW 144
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.75
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090204
#define MM_TAG "GOLD24_MULTI_04"
#include "multimethod_engine.mqh"
