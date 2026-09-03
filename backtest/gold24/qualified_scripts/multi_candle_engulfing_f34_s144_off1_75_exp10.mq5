#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// CANDLE_ENGULFING f34/s144 p1=66.0 p2=58.0 p3=1.0 off=1.75 exp=10 | hash 7a11760c49f5b9f030703bad55649258355b18dea4bc1971c43ae33553a13b64
#define MM_FAMILY_CODE 2
#define MM_FAST 34
#define MM_SLOW 144
#define MM_P1 66.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_SL_USD 22.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 10
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7a11760c49f5b9f030703bad55649258355b18dea4bc1971c43ae33553a13b64"
#define MM_MAGIC 24090405
#define MM_TAG "GOLD24_MULTI_05"
#include "multimethod_engine.mqh"
