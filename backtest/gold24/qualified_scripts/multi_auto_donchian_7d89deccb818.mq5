#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// DONCHIAN f3/s100 p1=55.0 p2=58.0 p3=1.0 off=3.25 exp=9 | hash 7d89deccb818740bd8cd11a8913439bdc20512c04fa326faa90e5ba93309f9fc
#define MM_FAMILY_CODE 1
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 55.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_SL_USD 20.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 3.25
#define MM_EXPIRY_BARS 9
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7d89deccb818740bd8cd11a8913439bdc20512c04fa326faa90e5ba93309f9fc"
#define MM_MAGIC 24687468
#define MM_TAG "GOLD10B_MULTI_066"
#include "multimethod_engine.mqh"
