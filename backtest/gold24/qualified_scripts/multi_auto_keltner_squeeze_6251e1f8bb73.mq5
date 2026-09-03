#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// KELTNER_SQUEEZE f34/s144 p1=1.0 p2=1.2 p3=1.0 off=2.5 exp=5 | hash 6251e1f8bb7302e43e7726b1090374c40a73d1bcd13d085cf5fb1a4bad49d307
#define MM_FAMILY_CODE 35
#define MM_FAST 34
#define MM_SLOW 144
#define MM_P1 1.0
#define MM_P2 1.2
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "6251e1f8bb7302e43e7726b1090374c40a73d1bcd13d085cf5fb1a4bad49d307"
#define MM_MAGIC 24833432
#define MM_TAG "GOLD10B_MULTI_115"
#include "multimethod_engine.mqh"
