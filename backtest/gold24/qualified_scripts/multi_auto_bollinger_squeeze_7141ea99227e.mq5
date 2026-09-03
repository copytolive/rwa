#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_SQUEEZE f14/s21 p1=0.05 p2=1.8 p3=1.0 off=1.75 exp=9 | hash 7141ea99227e1fbef3aa23de8e75456d8103683836af8c9a25432c7394441bc7
#define MM_FAMILY_CODE 34
#define MM_FAST 14
#define MM_SLOW 21
#define MM_P1 0.05
#define MM_P2 1.8
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "STOP"
#define MM_CONFIG_HASH "7141ea99227e1fbef3aa23de8e75456d8103683836af8c9a25432c7394441bc7"
#define MM_MAGIC 24245305
#define MM_TAG "GOLD10B_MULTI_097"
#include "multimethod_engine.mqh"
