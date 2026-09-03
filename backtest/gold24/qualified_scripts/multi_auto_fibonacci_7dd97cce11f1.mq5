#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// FIBONACCI f3/s5 p1=0.618 p2=5.0 p3=1.0 off=1.25 exp=12 | hash 7dd97cce11f10cbb2f45d991e906b9cc814af8e274840c9955f7e2357ebcd601
#define MM_FAMILY_CODE 18
#define MM_FAST 3
#define MM_SLOW 5
#define MM_P1 0.618
#define MM_P2 5.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 1.25
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "7dd97cce11f10cbb2f45d991e906b9cc814af8e274840c9955f7e2357ebcd601"
#define MM_MAGIC 24305262
#define MM_TAG "GOLD10B_MULTI_110"
#include "multimethod_engine.mqh"
