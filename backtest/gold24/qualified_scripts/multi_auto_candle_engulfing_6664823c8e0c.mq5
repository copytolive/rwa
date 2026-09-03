#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CANDLE_ENGULFING f21/s144 p1=52.0 p2=52.0 p3=1.0 off=4.25 exp=12 | hash 6664823c8e0c326741a3e1171f186faa9b1fcb285a343a0b7bb4ceac71b2969f
#define MM_FAMILY_CODE 2
#define MM_FAST 21
#define MM_SLOW 144
#define MM_P1 52.0
#define MM_P2 52.0
#define MM_P3 1.0
#define MM_SL_USD 18.0
#define MM_TP_USD 19.0
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "6664823c8e0c326741a3e1171f186faa9b1fcb285a343a0b7bb4ceac71b2969f"
#define MM_MAGIC 24362972
#define MM_TAG "GOLD10B_MULTI_043"
#include "multimethod_engine.mqh"
