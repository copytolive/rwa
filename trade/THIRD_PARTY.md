# Third-party reference

Architecture and behavior were reviewed against:

- `smoltz29j/hl-terminal` — MIT-licensed unofficial Hyperliquid frontend.
- `@nktkas/hyperliquid` — community-supported Hyperliquid SDK, pinned to 0.33.3 in this build.
- `viem` — pinned browser wallet/account dependency.

RWA does not copy the plaintext-agent-storage design from the reference terminal. This package replaces it with encrypted IndexedDB storage, fail-closed delegated-agent requirements for risk-increasing writes, stricter withdrawal separation, bounded risk limits, and a mainnet lock.
