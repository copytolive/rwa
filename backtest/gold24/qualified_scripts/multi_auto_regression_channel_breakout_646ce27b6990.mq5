#property strict
#property version "4.00"
#property description "GOLD10B dynamic canonical translation"
// REGRESSION_CHANNEL_BREAKOUT f10/s21 p1=0.02 p2=1.0 p3=1.0 off=4.25 exp=8 | hash 646ce27b699055e0853e47d5cdfc92a32df77d0fef2f3169772560d73a896fe2
#define MM_FAMILY_CODE 47
#define MM_FAST 10
#define MM_SLOW 21
#define MM_P1 0.02
#define MM_P2 1.0
#define MM_P3 1.0
#define MM_SL_USD 25.0
#define MM_TP_USD 25.0
#define MM_OFFSET_USD 4.25
#define MM_EXPIRY_BARS 8
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_ENTRY_METHOD "LIMIT"
#define MM_CONFIG_HASH "646ce27b699055e0853e47d5cdfc92a32df77d0fef2f3169772560d73a896fe2"
#define MM_MAGIC 24157467
#define MM_TAG "GOLD10B_MULTI_014"
#include "multimethod_engine.mqh"
