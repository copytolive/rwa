#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f5/s89 p1=2.1 p2=55.0 p3=1.0 off=3.25 exp=7 | hash f402d96a0ff0d844baced008f516c6ae75c28d25299626889373b8fa59086506
#define MM_FAMILY_CODE 44
#define MM_FAST 5
#define MM_SLOW 89
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 3.25
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "f402d96a0ff0d844baced008f516c6ae75c28d25299626889373b8fa59086506"
#define MM_MAGIC 24327434
#define MM_TAG "GOLD10B_MULTI_037"
#include "multimethod_engine.mqh"
