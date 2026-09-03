#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// KELTNER_SQUEEZE f3/s100 p1=0.7 p2=0.5 p3=1.0 off=1.5 exp=12 | hash e2b0227ed8f6c2254ccf425ceef73ba28eab368389679e1705cf411fd641f00f
#define MM_FAMILY_CODE 35
#define MM_FAST 3
#define MM_SLOW 100
#define MM_P1 0.7
#define MM_P2 0.5
#define MM_P3 1.0
#define MM_SL_USD 20.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 1.5
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "e2b0227ed8f6c2254ccf425ceef73ba28eab368389679e1705cf411fd641f00f"
#define MM_MAGIC 24893982
#define MM_TAG "GOLD10B_MULTI_006"
#include "multimethod_engine.mqh"
