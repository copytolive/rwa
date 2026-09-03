#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLUME f14/s21 p1=1.4 p2=55.0 p3=1.0 off=0.5 exp=3 | hash f5dbf4ecc03823ebd3f8c1214aff1af2bb9564c2c227b190b46a6cf74243be8b
#define MM_FAMILY_CODE 6
#define MM_FAST 14
#define MM_SLOW 21
#define MM_P1 1.4
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 3
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "f5dbf4ecc03823ebd3f8c1214aff1af2bb9564c2c227b190b46a6cf74243be8b"
#define MM_MAGIC 24133004
#define MM_TAG "GOLD10B_MULTI_077"
#include "multimethod_engine.mqh"
