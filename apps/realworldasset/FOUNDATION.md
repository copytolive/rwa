# RWA.MS Foundation Contract

## Visual language
- Dark navy product shell with cool blue primary actions.
- 12-column layout, max-width 1440px, 24px gutters.
- 4pt spacing scale.
- Borders are subtle but visible; surfaces use elevation sparingly.
- Status semantics are stable across the product: blue=informational/current, green=success/operational, amber=warning/in progress, red=blocking/error, purple=verification/action required.

## Component conventions
- All interactive controls expose visible focus states.
- Disabled controls must be non-interactive and visually reduced, not removed.
- Error messaging is concise, human-readable, and followed by a recovery action where possible.
- Empty states have one primary action and optionally one secondary text action.
- Loading states preserve layout dimensions with skeletons to minimize layout shift.
- Permission states distinguish access mode, reason, what remains available, and a next step.
- Responsive tables scroll horizontally rather than collapsing critical finance columns.

## API stability
Future batches should import from `@/components` or `@/components/ui` / `@/components/states` instead of creating page-specific duplicates.
