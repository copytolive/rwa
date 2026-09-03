#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_SQUEEZE f20/s21 p1=0.05 p2=1.5 p3=1.0 off=0.75 exp=12 | hash 588ca61ecb5250e0988185be9f03d22d051c2ff4236f7f143b4bbace5fbdbd8b
#define MM_FAMILY_CODE 34
#define MM_FAST 20
#define MM_SLOW 21
#define MM_P1 0.05
#define MM_P2 1.5
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 0.75
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "588ca61ecb5250e0988185be9f03d22d051c2ff4236f7f143b4bbace5fbdbd8b"
#define MM_MAGIC 24112574
#define MM_TAG "GOLD10B_MULTI_039"
#include "multimethod_engine.mqh"
