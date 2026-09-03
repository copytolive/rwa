#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_SQUEEZE f20/s21 p1=0.05 p2=1.8 p3=1.0 off=1.0 exp=8 | hash b87e78323bb4ef31a472300dea040ec9abe1892ce24c5d7ffa5032e7c190b1c6
#define MM_FAMILY_CODE 34
#define MM_FAST 20
#define MM_SLOW 21
#define MM_P1 0.05
#define MM_P2 1.8
#define MM_P3 1.0
#define MM_SL_USD 21.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "b87e78323bb4ef31a472300dea040ec9abe1892ce24c5d7ffa5032e7c190b1c6"
#define MM_MAGIC 24196050
#define MM_TAG "GOLD10B_MULTI_030"
#include "multimethod_engine.mqh"
