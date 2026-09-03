#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// VOLATILITY f3/s8 p1=1.2 p2=55.0 p3=1.0 off=2.25 exp=12 | hash d7adc8e5c379957dcea77624ed18e934334f83c393dc52583d3b20a9d74b4648
#define MM_FAMILY_CODE 19
#define MM_FAST 3
#define MM_SLOW 8
#define MM_P1 1.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 2.25
#define MM_EXPIRY_BARS 12
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "d7adc8e5c379957dcea77624ed18e934334f83c393dc52583d3b20a9d74b4648"
#define MM_MAGIC 24190597
#define MM_TAG "GOLD10B_MULTI_020"
#include "multimethod_engine.mqh"
