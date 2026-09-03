#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CHART_PATTERN f5/s34 p1=1.0 p2=55.0 p3=1.0 off=2.25 exp=8 | hash fe679a1d8c652f7fdeec58a605252c3eafdaa675547cdaebf587e0208285b650
#define MM_FAMILY_CODE 3
#define MM_FAST 5
#define MM_SLOW 34
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 19.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "fe679a1d8c652f7fdeec58a605252c3eafdaa675547cdaebf587e0208285b650"
#define MM_MAGIC 24302525
#define MM_TAG "GOLD10B_MULTI_016"
#include "multimethod_engine.mqh"
