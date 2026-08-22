# RWA Suite Architecture

- Hosting: GitHub Pages
- Market data: public exchange feeds
- Identity/social: browser-signed Nostr events
- Trader verification: signed EVM wallet link + public Hyperliquid account history
- Copy trading: browser watcher + manual wallet-sign review queue; max notional and max-loss guard
- Watchlist/alerts: browser local storage + notifications while app is active
- Portfolio: public Hyperliquid clearinghouse/portfolio data
- RWA assets: public verified registry; local drafts remain explicitly unverified
- Execution: Hyperliquid limit orders signed by the user's browser wallet; testnet default; explicit mainnet confirmation

No private keys are stored in the repository or application storage.
