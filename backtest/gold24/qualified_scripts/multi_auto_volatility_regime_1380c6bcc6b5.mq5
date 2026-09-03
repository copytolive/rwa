#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY_REGIME f5/s10 p1=1.1 p2=0.8 p3=1.0 off=2.0 exp=8 | hash 1380c6bcc6b5d5a59b0c46d59acb87eb33d707cabab57a50f4a4caade962b11c
#define MM_FAMILY_CODE 7
#define MM_FAST 5
#define MM_SLOW 10
#define MM_P1 1.1
#define MM_P2 0.8
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "1380c6bcc6b5d5a59b0c46d59acb87eb33d707cabab57a50f4a4caade962b11c"
#define MM_MAGIC 24106588
#define MM_TAG "GOLD10B_MULTI_042"
#include "multimethod_engine.mqh"
