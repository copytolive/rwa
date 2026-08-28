# Ecommerce Market Side Rail V1.3

Acceptance contract:

- Ecommerce remains in the canonical `/rwa/` document.
- Opening Ecommerce anchors the visible background to the market/chart shell.
- Ecommerce renders as a right-side rail, not a viewport takeover.
- Products are the default Ecommerce tab so products remain visible beside the market.
- Desktop keeps a meaningful chart width visible at 2048×1129, 1600×1000, 1440×900, and 1366×768.
- Mobile keeps a visible market edge while Ecommerce remains a same-page right rail at 320, 360, 375, 390, 393, 412, and 430px widths.
- No popup or external Ecommerce navigation.
- No horizontal overflow.
- Closing restores the prior RWA route/context.
- Backend remains fail-closed; this UI change does not claim Ecommerce LIVE.
