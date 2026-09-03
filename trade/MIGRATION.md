# Migration plan

This package is published under `/trade/` first so the existing RWA homepage remains untouched.

After successful TESTNET E2E validation:
1. keep `/trade/` as the execution application;
2. link the existing RWA terminal to `/trade/`;
3. do not enable mainnet until the release policy explicitly changes `mainnetEnabled` to `true` after review.

No Vercel frontend is required for this package.
