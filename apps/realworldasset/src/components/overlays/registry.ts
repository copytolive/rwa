export const overlayRegistry = {
  connectWallet: "connect-wallet",
  confirmBuy: "confirm-buy",
  addWatchlist: "add-watchlist",
  setAlert: "set-alert",
  share: "share",
  followConfirmation: "follow-confirmation",
  joinRewards: "join-rewards",
  transactionSuccess: "transaction-success",
  cartCheckout: "cart-checkout",
} as const;

export type OverlayId = typeof overlayRegistry[keyof typeof overlayRegistry];
