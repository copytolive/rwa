#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// CANDLE_ENGULFING f50/s100 p1=55 p2=66 p3=1 off=3.75 exp=8 | hash 68c3985dfe3bea091f2af4c84dbae5bcc67439a5f04199dd17170020b71dba54
// p1/p2/p3 are canonical identity parameters; CANDLE_ENGULFING signal_series in core.py does not consume them.
#define MM_FAMILY_CODE 2
#define MM_FAST 50
#define MM_SLOW 100
#define MM_SL_USD 23.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 3.75
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090207
#define MM_TAG "GOLD24_MULTI_07"
#include "multimethod_engine.mqh"
