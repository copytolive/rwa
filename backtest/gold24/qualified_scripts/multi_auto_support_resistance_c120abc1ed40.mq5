#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// SUPPORT_RESISTANCE f3/s26 p1=1.0 p2=55.0 p3=1.0 off=1.75 exp=8 | hash c120abc1ed40e711821b0e7f7b208b4afc4aba88ec0f3c1915d80254254ae1de
#define MM_FAMILY_CODE 17
#define MM_FAST 3
#define MM_SLOW 26
#define MM_P1 1.0
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 23.5
#define MM_TP_USD 24.0
#define MM_OFFSET_USD 1.75
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "STOP"
#define MM_CONFIG_HASH "c120abc1ed40e711821b0e7f7b208b4afc4aba88ec0f3c1915d80254254ae1de"
#define MM_MAGIC 24243809
#define MM_TAG "GOLD10B_MULTI_092"
#include "multimethod_engine.mqh"
