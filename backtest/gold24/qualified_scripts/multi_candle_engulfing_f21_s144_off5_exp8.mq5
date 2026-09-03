#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// CANDLE_ENGULFING f21/s144 p1=66.0 p2=62.0 p3=1.0 off=5.0 exp=8 | hash c8598fa098e7c37d0e0c8cd5d6408eff10d2cca5f54c9c5b1c56c8fe6c909291
#define MM_FAMILY_CODE 2
#define MM_FAST 21
#define MM_SLOW 144
#define MM_P1 66.0
#define MM_P2 62.0
#define MM_P3 1.0
#define MM_SL_USD 18.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "c8598fa098e7c37d0e0c8cd5d6408eff10d2cca5f54c9c5b1c56c8fe6c909291"
#define MM_MAGIC 24090404
#define MM_TAG "GOLD24_MULTI_04"
#include "multimethod_engine.mqh"
