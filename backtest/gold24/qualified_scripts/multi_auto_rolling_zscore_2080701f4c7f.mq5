#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ROLLING_ZSCORE f5/s50 p1=2.1 p2=55.0 p3=1.0 off=1.25 exp=11 | hash 2080701f4c7ffd612ee0e328ce18d38307fe0cf622722e8dca8ed856aa15ff92
#define MM_FAMILY_CODE 44
#define MM_FAST 5
#define MM_SLOW 50
#define MM_P1 2.1
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "2080701f4c7ffd612ee0e328ce18d38307fe0cf622722e8dca8ed856aa15ff92"
#define MM_MAGIC 24588223
#define MM_TAG "GOLD10B_MULTI_034"
#include "multimethod_engine.mqh"
