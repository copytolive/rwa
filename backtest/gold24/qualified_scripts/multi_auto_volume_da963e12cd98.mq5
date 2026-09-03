#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLUME f55/s144 p1=1.2 p2=55.0 p3=1.0 off=1.75 exp=7 | hash da963e12cd98d9e31885db06c211ae824bf34ae85962585f68aa89027c531d4c
#define MM_FAMILY_CODE 6
#define MM_FAST 55
#define MM_SLOW 144
#define MM_P1 1.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "da963e12cd98d9e31885db06c211ae824bf34ae85962585f68aa89027c531d4c"
#define MM_MAGIC 24179378
#define MM_TAG "GOLD10B_MULTI_057"
#include "multimethod_engine.mqh"
