#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s21 p1=2.0 p2=40.0 p3=1.0 off=2.25 exp=8 | hash 389deb183b6da164f6be3b08b5cc87f5d2659602832e0db32bf318ee3ee2275b
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 21
#define MM_P1 2.0
#define MM_P2 40.0
#define MM_P3 1.0
#define MM_SL_USD 19.0
#define MM_TP_USD 21.5
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "389deb183b6da164f6be3b08b5cc87f5d2659602832e0db32bf318ee3ee2275b"
#define MM_MAGIC 24373432
#define MM_TAG "GOLD10B_MULTI_029"
#include "multimethod_engine.mqh"
