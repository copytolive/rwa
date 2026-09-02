#ifndef GOLD24_MULTIMETHOD_ENGINE_COMPAT_MQH
#define GOLD24_MULTIMETHOD_ENGINE_COMPAT_MQH
// Backward-compatible bridge: existing Multi-Method wrappers keep MM_* names,
// while all qualified EAs execute through the same hardened MT5 engine.
#define QM_FAMILY_CODE MM_FAMILY_CODE
#define QM_FAST MM_FAST
#define QM_SLOW MM_SLOW
#ifdef MM_P1
#define QM_P1 MM_P1
#endif
#ifdef MM_P2
#define QM_P2 MM_P2
#endif
#ifdef MM_P3
#define QM_P3 MM_P3
#endif
#define QM_SL_USD MM_SL_USD
#define QM_TP_USD MM_TP_USD
#define QM_OFFSET_USD MM_OFFSET_USD
#define QM_EXPIRY_BARS MM_EXPIRY_BARS
#define QM_DIRECTION_MODE MM_DIRECTION_MODE
#define QM_MAGIC MM_MAGIC
#define QM_TAG MM_TAG
#include "qualified_engine.mqh"
#endif
