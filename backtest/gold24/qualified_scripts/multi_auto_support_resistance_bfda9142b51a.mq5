#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s26 p1=1.0 p2=55.0 p3=1.0 off=1.75 exp=11 | hash bfda9142b51a0b890f97b3ba56d1944bb79cec49e2177ad7e54ce110edd1304b
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 26
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 20.0
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "bfda9142b51a0b890f97b3ba56d1944bb79cec49e2177ad7e54ce110edd1304b"
#define MM_MAGIC 24472290
#define MM_TAG "GOLD10B_MULTI_031"
#include "multimethod_engine.mqh"
