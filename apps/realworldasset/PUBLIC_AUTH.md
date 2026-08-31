# RWA.MS Public/Auth/Wallet Flow — CHAT 01

Reference screens: 01 Public Landing, 02 Login/Sign Up, 03 First-Time Onboarding, 04 Connect Wallet Modal, 05 Manage Wallet.

## Routes

- `/` — public landing
- `/login` — log in UI
- `/signup` — sign up UI
- `/onboarding` — four-step onboarding flow
- `/account/wallet` — manage wallets
- `/home` — route-safe authenticated hand-off for CHAT 02
- `[...slug]` — route-safe fallback for visible links whose full pages arrive in later batches

## Interaction contract

- Landing Log In / Sign Up navigate to their real routes.
- Authentication validates fields, has loading/error states, and lands on onboarding.
- Google, Apple, Passkey and wallet auth controls all advance to onboarding in this UI-stage mock.
- Onboarding supports category selection (max 3), follow/unfollow, wallet connect, profile setup, skip/back/continue, and completion to `/home`.
- Every Connect Wallet trigger reuses `ConnectWalletModal` from CHAT 00B.
- Manage Wallet supports connect, copy address, set default, rename, disconnect, mode toggle, route navigation, and session revocation with reusable 00B dialogs.
- All visible navigation destinations resolve through exact routes or the route-safe placeholder instead of dead-ending.

No Button/Input/Dialog primitive is duplicated; CHAT 01 composes the merged 00A/00B foundation.
