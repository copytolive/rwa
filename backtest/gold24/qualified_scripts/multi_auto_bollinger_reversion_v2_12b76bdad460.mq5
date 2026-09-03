#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// BOLLINGER_REVERSION_V2 f5/s13 p1=1.5 p2=35.0 p3=1.0 off=2.25 exp=11 | hash 12b76bdad4601e58408de5831b22898ea30e80fc1c5d30d4715b64163ecebbb1
#define MM_FAMILY_CODE 5
#define MM_FAST 5
#define MM_SLOW 13
#define MM_P1 1.5
#define MM_P2 35.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 11
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "12b76bdad4601e58408de5831b22898ea30e80fc1c5d30d4715b64163ecebbb1"
#define MM_MAGIC 24510586
#define MM_TAG "GOLD10B_MULTI_079"
#include "multimethod_engine.mqh"
