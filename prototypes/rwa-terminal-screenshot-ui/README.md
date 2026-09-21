# RWA Terminal — editable desktop + mobile prototype

This prototype converts the supplied RWA trading-terminal screenshot into two explicit views:

- `desktop.html` — desktop terminal layout.
- `mobile.html` — mobile trading layout.

It follows the same screenshot-to-code idea as `abi/screenshot-to-code` while keeping the deliverable dependency-free so it can be reviewed and wired into the existing RWA codebase without changing production first.

## Editable slot system

Every important button uses `data-slot="..."`. Slot behavior is defined in `config.js`:

```js
tradeBuy: {
  label: "Buy",
  system: "trade-execution",
  action: "set-side",
  target: "buy",
  enabled: true
}
```

This means a label or entire backend/system mapping can be swapped without rebuilding the layout.

### Runtime editor

Open either HTML file and click **⚙ Edit slots**. All editable controls are outlined. Click one to edit:

- label;
- system adapter;
- action;
- target/route/key;
- enabled state.

Changes are saved to browser `localStorage` for visual iteration.

### Production wiring

`config.js` contains `RWA_ADAPTERS`. Replace each adapter with the actual application module/API integration. The `trade-execution` adapter is deliberately **preview-only** in this prototype; it never sends a real order.

Recommended adapter boundaries:

| System | Owns |
| --- | --- |
| `router` | navigation and tabs |
| `chart` | timeframe, indicators, templates |
| `trade-execution` | side, order type, validation, order submission |
| `watchlist` | watched assets and movers |
| `social-feed` | signals, posts, composer |
| `portfolio` | positions and portfolio routes |
| `analytics` | analytics views |
| `rewards` | rewards routes |
| `alerts` | alert creation/list |
| `wallet` | wallet/account drawer |
| `profile` | mobile profile |

## Review without touching production

Serve this folder with any static server, for example:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080/desktop.html`
- `http://localhost:8080/mobile.html`

## Suggested integration order

1. Approve desktop/mobile visual parity.
2. Map existing RWA routes into `router` slots.
3. Replace chart adapter with the existing chart engine.
4. Replace order book/market-data placeholders with live data subscriptions.
5. Wire trade execution last, keeping preview mode until testnet validation passes.
