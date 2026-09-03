#property strict
#property version "2.20"
#property description "GOLD24 Multi-Method canonical translation"
// VOLUME f13/s144 p1=1.4 p2=55.0 p3=1.0 off=4.75 exp=8 | hash e0c3f07796453a518fb37bb614058e586c950bbe20c982963004528d7c412cb3
#define MM_FAMILY_CODE 6
#define MM_FAST 13
#define MM_SLOW 144
#define MM_P1 1.4
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 24.0
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 4.75
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "BOTH"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "e0c3f07796453a518fb37bb614058e586c950bbe20c982963004528d7c412cb3"
#define MM_MAGIC 24090409
#define MM_TAG "GOLD24_MULTI_09"
#include "multimethod_engine.mqh"
