#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f34/s144 p1=62 p2=66 p3=1 off=4.5 exp=8 | hash aa50efa4bf3e91060ff7938d45928802aef1e02995bdfb98fa08ad43d12facb3
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 34
#define MM_SLOW 144
#define MM_SL_USD 18.0
#define MM_TP_USD 21.0
#define MM_OFFSET_USD 4.5
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090205
#define MM_TAG "GOLD24_MULTI_05"
#include "multimethod_engine.mqh"
