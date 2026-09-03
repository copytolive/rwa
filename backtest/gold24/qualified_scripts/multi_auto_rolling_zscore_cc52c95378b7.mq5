#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f3/s100 p1=0.5 p2=55.0 p3=1.0 off=1.5 exp=12 | hash cc52c95378b7e7b239c871cd2b77689c087b082649f05ef9b7b2ec3b9946f5ec
#define MM_FAMILY_CODE 44
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 0.5
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "cc52c95378b7e7b239c871cd2b77689c087b082649f05ef9b7b2ec3b9946f5ec"
#define MM_MAGIC 24877555
#define MM_TAG "GOLD10B_MULTI_019"
#include "multimethod_engine.mqh"
