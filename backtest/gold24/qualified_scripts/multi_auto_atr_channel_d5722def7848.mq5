#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// ATR_CHANNEL f10/s89 p1=1.8 p2=55.0 p3=1.0 off=0.5 exp=4 | hash d5722def7848c3d7ed796ab330af0c9735744e0256d168cd130085dfbcd81cc1
#define MM_FAMILY_CODE 29
#define MM_FAST 10
#define MM_SLOW 89
#define MM_P1 1.8
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 0.5
#define MM_EXPIRY_BARS 4
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "d5722def7848c3d7ed796ab330af0c9735744e0256d168cd130085dfbcd81cc1"
#define MM_MAGIC 24329871
#define MM_TAG "GOLD10B_MULTI_034"
#include "multimethod_engine.mqh"
