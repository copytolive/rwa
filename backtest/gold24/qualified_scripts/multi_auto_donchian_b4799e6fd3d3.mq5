#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f3/s34 p1=62.0 p2=52.0 p3=1.0 off=1.0 exp=5 | hash b4799e6fd3d3fcc8b2d99c2b7a42b704cb39a2546454971eeb8594b78a1562e1
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 34
#define MM_P1 62.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "b4799e6fd3d3fcc8b2d99c2b7a42b704cb39a2546454971eeb8594b78a1562e1"
#define MM_MAGIC 24769295
#define MM_TAG "GOLD10B_MULTI_061"
#include "multimethod_engine.mqh"
