# RWA.MS Overlay System — CHAT 00B

Reference: `60 - Modal - Drawer Component Sheet.png`.

This reference is implemented as a reusable interaction layer, not as a standalone route.

## Base primitives

- `Dialog` — centered modal with focus trap, escape-to-close, backdrop dismissal, body scroll lock and focus restoration.
- `Drawer` — right or bottom sheet using the same accessible base.
- `ConfirmationDialog` — reusable confirmation state with pending/loading behavior.
- `SuccessDialog` — reusable success state.
- `FormDialog` — reusable form-in-overlay pattern using the shared inputs/buttons from CHAT 00A.
- `OverlayActions` / `OverlayStack` — shared layout helpers for overlay content and actions.

## Reusable patterns

- `ConnectWalletModal`
- `ConfirmBuyModal`
- `AddWatchlistModal`
- `SetAlertModal`
- `ShareModal`
- `FollowConfirmationModal`
- `JoinRewardsModal`
- `TransactionSuccessModal`
- `CartCheckoutDrawer`

## Integration rules

Future pages must call these components rather than duplicating modal markup or local overlay CSS. Overlay IDs are centralized in `overlayRegistry` for app-level orchestration.

No route is created for screen 60.
