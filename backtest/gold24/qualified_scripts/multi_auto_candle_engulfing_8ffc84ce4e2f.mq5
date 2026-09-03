#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// CANDLE_ENGULFING f50/s89 p1=58.0 p2=58.0 p3=1.0 off=3.0 exp=7 | hash 8ffc84ce4e2f10f23e2456f35a0a6a3ff0c5c04668586f6696c9ccc1a46f0ffb
#define MM_FAMILY_CODE 2
#define MM_FAST 50
#define MM_SLOW 89
#define MM_P1 58.0
#define MM_P2 58.0
#define MM_P3 1.0
#define MM_SL_USD 21.5
#define MM_TP_USD 23.5
#define MM_OFFSET_USD 3.0
#define MM_EXPIRY_BARS 7
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "8ffc84ce4e2f10f23e2456f35a0a6a3ff0c5c04668586f6696c9ccc1a46f0ffb"
#define MM_MAGIC 24590958
#define MM_TAG "GOLD10B_MULTI_094"
#include "multimethod_engine.mqh"
