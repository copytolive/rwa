# RWA.MS Core Navigation — CHAT 02

Reference screens: 61 Authenticated Home / Main Feed, 62 Discover Hub, 06 Global Search Results, 07 Business Directory, 08 RWA Directory.

## Routes

- `/home` — authenticated main feed
- `/discover` — discover hub
- `/search?q=...` — global search results
- `/businesses` — business directory
- `/rwa` — RWA directory

## Shared shell

`AppShell` / `AppHeader` is the single authenticated navigation shell. It owns authenticated navigation, global header search, Simple/PRO mode, Post Thesis, notifications, theme toggle, account entry, wallet modal and footer.

## Interaction contract

All visible actions in CHAT 02 either:
- navigate to a real route,
- navigate to a route-safe future destination,
- open an existing reusable overlay,
- submit search/filter state,
- or mutate local UI state such as follow/watchlist/filter/view mode.

Business cards link to `/businesses/[business]`; RWA cards link to `/rwa/[asset]`. Detail screens are intentionally route-safe handoffs for CHAT 03.
