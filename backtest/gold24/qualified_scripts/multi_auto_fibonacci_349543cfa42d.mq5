#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIBONACCI f10/s20 p1=0.786 p2=3.0 p3=1.0 off=1.0 exp=8 | hash 349543cfa42db15be16fae6dcdb7b93a659037ec797aa7216f0647ae317cda38
#define MM_FAMILY_CODE 18
#define MM_FAST 10
#define MM_SLOW 20
#define MM_P1 0.786
#define MM_P2 3.0
#define MM_P3 1.0
#define MM_SL_USD 22.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.0
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "349543cfa42db15be16fae6dcdb7b93a659037ec797aa7216f0647ae317cda38"
#define MM_MAGIC 24697455
#define MM_TAG "GOLD10B_MULTI_083"
#include "multimethod_engine.mqh"
