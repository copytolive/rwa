"use client";

import * as React from "react";
import { Badge, Button, Input, Select, Tabs } from "@/components/ui";
import { Dialog, Drawer, OverlayActions } from "./Overlay";

export interface ControlledOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWalletModal({ open, onOpenChange, wallets = ["MetaMask", "WalletConnect", "Coinbase Wallet", "Rabby Wallet", "Phantom"], onConnect }: ControlledOverlayProps & { wallets?: string[]; onConnect?: (wallet: string) => void }) {
  const [selected, setSelected] = React.useState(wallets[0] ?? "MetaMask");
  const [network, setNetwork] = React.useState("Ethereum Mainnet");
  const [moreOpen, setMoreOpen] = React.useState(false);
  React.useEffect(() => { if (open && !wallets.includes(selected)) setSelected(wallets[0] ?? "MetaMask"); }, [open, wallets, selected]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Connect Wallet" size="lg">
      <div className="rwa-connect-wallet-grid">
        <div className="rwa-connect-wallet-list">
          {wallets.map((wallet) => (
            <button type="button" className={`rwa-option-row ${selected === wallet ? "is-selected" : ""}`} key={wallet} onClick={() => setSelected(wallet)}>
              <span className="rwa-option-row__icon" aria-hidden="true">{wallet.slice(0,1)}</span>
              <span>{wallet}</span>
              {selected === wallet ? <span className="rwa-wallet-check">✓</span> : <span className="rwa-option-row__chevron">›</span>}
            </button>
          ))}
          <button type="button" className="rwa-option-row" onClick={() => setMoreOpen(v => !v)}><span className="rwa-option-row__icon">⌘</span><span>{moreOpen ? "Hide Wallet Help" : "More Wallets"}</span><span className="rwa-option-row__chevron">›</span></button>
        {moreOpen && <p className="rwa-overlay-note" role="status">All supported wallets are listed above. Select one, choose a network, then connect.</p>}
        </div>
        <div className="rwa-connect-wallet-detail">
          <div className="rwa-wallet-hero"><span>{selected.slice(0,1)}</span><div><h3>{selected}</h3><p>Secure, self-custodial access to RWA.MS.</p></div></div>
          <ul className="rwa-wallet-benefits"><li><b>♢ Secure & Non-Custodial</b><span>You own your keys and your assets.</span></li><li><b>ϟ Connect in One Click</b><span>Fast, seamless, and easy to use.</span></li><li><b>◎ Supports Multiple Networks</b><span>Ethereum, Polygon, Arbitrum, Optimism, and more.</span></li></ul>
          <Select label="Network" value={network} onChange={(e) => setNetwork(e.target.value)}><option>Ethereum Mainnet</option><option>Arbitrum One</option><option>Polygon</option><option>BNB Smart Chain</option></Select>
          <div className="rwa-wallet-preview"><span className="rwa-wallet-preview__avatar">R</span><div><small>Connected Account (Preview)</small><b>0x7f3a…9c4b <Badge tone="primary">PRIMARY</Badge></b></div><div><b>2.48 ETH</b><small>$6,842.35 USD</small></div></div>
          <Button className="rwa-overlay__full" size="lg" onClick={() => onConnect ? onConnect(selected) : onOpenChange(false)}>Connect {selected}</Button>
        </div>
      </div>
      <p className="rwa-overlay-note">By connecting, you agree to the platform Terms of Service and Privacy Policy. RWA.MS never stores your private keys.</p>
    </Dialog>
  );
}

export function ConfirmBuyModal({ open, onOpenChange, assetName = "Kopi Nusantara Token", symbol = "KOPI", quantity = "1,000", price = "$2.48", subtotal = "$2,480.00", networkFee = "$4.21", slippage = "0.50%", total = "$2,484.21", onConfirm }: ControlledOverlayProps & { assetName?: string; symbol?: string; quantity?: string; price?: string; subtotal?: string; networkFee?: string; slippage?: string; total?: string; onConfirm?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Confirm Buy" size="sm" footer={<Button className="rwa-overlay__full" onClick={() => onConfirm ? onConfirm() : onOpenChange(false)}>Confirm Buy</Button>}>
      <div className="rwa-asset-summary"><div className="rwa-asset-summary__avatar">K</div><div><strong>{assetName}</strong><span>{symbol}</span></div></div>
      <div className="rwa-order-quantity">{quantity} <span>{symbol}</span></div>
      <dl className="rwa-key-values">
        <div><dt>Price</dt><dd>{price}</dd></div><div><dt>Subtotal</dt><dd>{subtotal}</dd></div><div><dt>Network Fee</dt><dd>{networkFee}</dd></div><div><dt>Slippage Tolerance</dt><dd>{slippage}</dd></div><div className="rwa-key-values__total"><dt>Total</dt><dd>{total}</dd></div>
      </dl>
    </Dialog>
  );
}

export function AddWatchlistModal({ open, onOpenChange, assetName = "KOPI", lists = ["My Watchlist"], onAdd }: ControlledOverlayProps & { assetName?: string; lists?: string[]; onAdd?: (list: string) => void }) {
  const [list, setList] = React.useState(lists[0] ?? "My Watchlist");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title={`Add ${assetName} to your watchlist`} description="Get price alerts, market updates, and stay informed about this asset." footer={<Button className="rwa-overlay__full" onClick={() => onAdd ? onAdd(list) : onOpenChange(false)}>Add to Watchlist</Button>}>
      <div className="rwa-feature-mark" aria-hidden="true">☆</div>
      <Select label="Watchlist" value={list} onChange={(e) => setList(e.target.value)}>{lists.map(item => <option key={item}>{item}</option>)}</Select>
    </Dialog>
  );
}

export function SetAlertModal({ open, onOpenChange, pair = "KOPI / USD", currentPrice = "$2.48", onCreate }: ControlledOverlayProps & { pair?: string; currentPrice?: string; onCreate?: (condition: { direction: string; price: string }) => void }) {
  const [direction, setDirection] = React.useState("above");
  const [price, setPrice] = React.useState("3.00");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Set Alert" size="sm" footer={<Button className="rwa-overlay__full" onClick={() => onCreate ? onCreate({ direction, price }) : onOpenChange(false)}>Create Alert</Button>}>
      <div className="rwa-market-line"><strong>{pair}</strong><span>{currentPrice}</span></div>
      <label className="rwa-overlay-label">Alert when price</label>
      <Tabs value={direction} onValueChange={setDirection} items={[{value:"above", label:"Above"}, {value:"below", label:"Below"}]} />
      <Input label="Price" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      <div className="rwa-condition-summary"><span>Condition Summary</span><strong>Notify me when {pair} is {direction} ${price}</strong></div>
    </Dialog>
  );
}

export function ShareModal({ open, onOpenChange, title = "Share Kopi Nusantara Token", url = "https://rwa.ms/token/kopi", onShare }: ControlledOverlayProps & { title?: string; url?: string; onShare?: (network: string) => void }) {
  const networks = ["X (Twitter)", "Telegram", "Discord", "LinkedIn"];
  const [copied, setCopied] = React.useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share" size="sm" footer={<Button variant="secondary" className="rwa-overlay__full" onClick={() => onOpenChange(false)}>Close</Button>}>
      <p className="rwa-overlay-center">{title}</p>
      <div className="rwa-share-grid">{networks.map(network => <button key={network} type="button" onClick={() => onShare ? onShare(network) : onOpenChange(false)}><span aria-hidden="true">↗</span>{network}</button>)}</div>
      <div className="rwa-copy-row"><code>{url}</code><Button size="sm" variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</Button></div>
    </Dialog>
  );
}

export function FollowConfirmationModal({ open, onOpenChange, businessName = "Kopi Nusantara", onViewProject }: ControlledOverlayProps & { businessName?: string; onViewProject?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} size="sm" title={`You're following ${businessName}`} description="You'll now receive updates about this project, including announcements and key metrics." footer={<OverlayActions stacked><Button onClick={() => onViewProject ? onViewProject() : onOpenChange(false)}>View Project</Button><Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button></OverlayActions>}>
      <div className="rwa-feature-mark rwa-feature-mark--success" aria-hidden="true">✓</div>
    </Dialog>
  );
}

export function JoinRewardsModal({ open, onOpenChange, businessName = "KOPI", onJoin }: ControlledOverlayProps & { businessName?: string; onJoin?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Earn rewards for your activity" description={`Stake ${businessName}, provide liquidity, and complete tasks to earn exclusive rewards.`} size="sm" footer={<OverlayActions stacked><Button onClick={() => onJoin ? onJoin() : onOpenChange(false)}>Join Now</Button><Button variant="secondary" onClick={() => onOpenChange(false)}>Learn More</Button></OverlayActions>}>
      <div className="rwa-feature-mark rwa-feature-mark--purple" aria-hidden="true">◇</div>
      <ul className="rwa-check-list"><li>Earn token rewards</li><li>Access exclusive campaigns</li><li>Boost your community standing</li></ul>
    </Dialog>
  );
}

export function TransactionSuccessModal({ open, onOpenChange, hash = "0x7a3f...9b12e4c", onExplorer }: ControlledOverlayProps & { hash?: string; onExplorer?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Transaction Successful!" description="Your transaction has been confirmed and will be reflected shortly." size="sm" footer={<OverlayActions stacked><Button onClick={() => onExplorer ? onExplorer() : onOpenChange(false)}>View on Explorer</Button><Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button></OverlayActions>}>
      <div className="rwa-success-mark" aria-hidden="true">✓</div>
      <div className="rwa-overlay-reference"><span>Transaction Hash</span><code>{hash}</code></div>
    </Dialog>
  );
}

export interface CartItem { id: string; name: string; symbol: string; quantity: string; total: string; }
export function CartCheckoutDrawer({ open, onOpenChange, items, subtotal = "$3,690.00", networkFee = "$4.21", slippage = "0.50%", total = "$3,694.21", onRemove, onCheckout, onClear, onAddMore }: ControlledOverlayProps & { items: CartItem[]; subtotal?: string; networkFee?: string; slippage?: string; total?: string; onRemove?: (id: string) => void; onCheckout?: () => void; onClear?: () => void; onAddMore?: () => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Your Cart" description={`${items.length} item${items.length === 1 ? "" : "s"}`} size="xl">
      <div className="rwa-cart-layout">
        <div className="rwa-cart-items">
          {items.map(item => <div className="rwa-cart-item" key={item.id}><div className="rwa-asset-summary__avatar">{item.symbol.slice(0,1)}</div><div className="rwa-cart-item__name"><strong>{item.name}</strong><span>{item.symbol}</span></div><div className="rwa-cart-item__amount"><strong>{item.quantity}</strong><span>{item.total}</span></div><button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemove ? onRemove(item.id) : onOpenChange(false)}>×</button></div>)}
          <button type="button" className="rwa-text-action" onClick={() => onAddMore ? onAddMore() : onOpenChange(false)}>＋ Add More Assets</button>
        </div>
        <aside className="rwa-order-summary">
          <h3>Order Summary</h3>
          <dl className="rwa-key-values"><div><dt>Subtotal</dt><dd>{subtotal}</dd></div><div><dt>Network Fee</dt><dd>{networkFee}</dd></div><div><dt>Slippage Tolerance</dt><dd>{slippage}</dd></div><div className="rwa-key-values__total"><dt>Total</dt><dd>{total}</dd></div></dl>
          <Button className="rwa-overlay__full" onClick={() => onCheckout ? onCheckout() : onOpenChange(false)}>Proceed to Checkout</Button>
          <Button className="rwa-overlay__full" variant="ghost" onClick={() => onClear ? onClear() : onOpenChange(false)}>Clear Cart</Button>
        </aside>
      </div>
    </Drawer>
  );
}
