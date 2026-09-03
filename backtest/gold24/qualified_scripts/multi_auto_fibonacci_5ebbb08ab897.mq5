#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIBONACCI f7/s8 p1=0.618 p2=5.0 p3=1.0 off=2.5 exp=6 | hash 5ebbb08ab8973788fa26cfb1982d6c86950955da19976f5da76f6d6a5c685a47
#define MM_FAMILY_CODE 18
#define MM_FAST 7
#define MM_SLOW 8
#define MM_P1 0.618
#define MM_P2 5.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.5
#define MM_EXPIRY_BARS 6
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "5ebbb08ab8973788fa26cfb1982d6c86950955da19976f5da76f6d6a5c685a47"
#define MM_MAGIC 24658730
#define MM_TAG "GOLD10B_MULTI_047"
#include "multimethod_engine.mqh"
