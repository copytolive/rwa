#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f50/s100 p1=55 p2=66 p3=1 off=4.25 exp=7 | hash 0c55ca7195b636d6661364f37d9601c5c2e6241e6b569d19eea5e564509850fe
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 50
#define MM_SLOW 100
#define MM_SL_USD 22.0
#define MM_TP_USD 22.0
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090206
#define MM_TAG "GOLD24_MULTI_06"
#include "multimethod_engine.mqh"
