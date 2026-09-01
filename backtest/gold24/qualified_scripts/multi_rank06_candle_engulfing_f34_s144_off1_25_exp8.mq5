#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f34/s144 p1=66 p2=58 p3=1 off=1.25 exp=8 | hash c7bf875486d7ce6dcbd638821f2932d6dac402aa6979023e79360e01f6ddfab5
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 34
#define MM_SLOW 144
#define MM_SL_USD 21.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090206
#define MM_TAG "GOLD24_MULTI_06"
#include "multimethod_engine.mqh"
