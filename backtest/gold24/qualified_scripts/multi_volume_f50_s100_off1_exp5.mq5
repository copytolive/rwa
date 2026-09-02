#property strict
#property version "2.10"
#property description "GOLD24 Multi-Method canonical translation"
// VOLUME f50/s100 p1=1.4 p2=55 p3=1 off=1 exp=5 | hash 09fb362cbb4fcbc244e2c5e9d3ec336466e6b63f391328af656f24482c15290d
#define MM_FAMILY_CODE 6
#define MM_FAST 50
#define MM_SLOW 100
#define MM_P1 1.4
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 18.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "BOTH"
#define MM_MAGIC 24090304
#define MM_TAG "GOLD24_MULTI_VOLUME"
#include "multimethod_engine.mqh"
