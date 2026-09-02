#property strict
#property version "2.00"
#property description "GOLD24 Multi-Method v1 canonical translation"
// ADAPTIVE_TREND f20/s144 p1=2.2 p2=55 p3=1 off=5 exp=5 | hash d3844bec737310d796a696cb50450f11295e7cb85580a619237f2e32f560a4c4
#define MM_FAMILY_CODE 4
#define MM_FAST 20
#define MM_SLOW 144
#define MM_P1 2.2
#define MM_P2 55.0
#define MM_P3 1.0
#define MM_SL_USD 22.5
#define MM_TP_USD 24.5
#define MM_OFFSET_USD 5.0
#define MM_EXPIRY_BARS 5
#define MM_DIRECTION_MODE "LONG_ONLY"
#define MM_MAGIC 24090302
#define MM_TAG "GOLD24_MULTI_ADAPT"
#include "multimethod_engine.mqh"
