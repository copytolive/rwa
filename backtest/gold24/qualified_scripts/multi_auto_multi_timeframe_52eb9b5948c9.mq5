#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// MULTI_TIMEFRAME f20/s100 p1=62.0 p2=62.0 p3=1.0 off=4.5 exp=11 | hash 52eb9b5948c9b7012d4d2fbad9a82f26cd4ef6c1e1364a2103afc9d0f84a00f9
#define MM_FAMILY_CODE 26
#define MM_FAST 20
#define MM_SLOW 100
#define MM_P1 62.0
#define MM_P2 62.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 4.5
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "52eb9b5948c9b7012d4d2fbad9a82f26cd4ef6c1e1364a2103afc9d0f84a00f9"
#define MM_MAGIC 24872441
#define MM_TAG "GOLD10B_MULTI_054"
#include "multimethod_engine.mqh"
