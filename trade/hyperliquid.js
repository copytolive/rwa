import { CONFIG } from './config.js';
import { saveAgent, getAgentRecord, loadAgentPrivateKey, markAgentReady, deleteAgent } from './storage.js';

let depsPromise;
async function deps() {
  if (!depsPromise) {
    depsPromise = Promise.all([
      import(CONFIG.sdkUrl),
      import(CONFIG.viemUrl),
      import(CONFIG.viemAccountsUrl),
      import(CONFIG.viemChainsUrl),
    ]).then(([hl, viem, accounts, chains]) => ({ hl, viem, accounts, chains }));
  }
  return depsPromise;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function assertAddress(value, label = 'address') {
  const out = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(out)) throw new Error(`Invalid ${label}`);
  return out;
}
function formatUsd(n) { return `$${num(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; }
function errText(error) {
  return String(error?.cause?.message || error?.shortMessage || error?.details || error?.message || error || 'Unknown error');
}
function assertResult(result, label = 'Action') {
  if (result?.status === 'err') throw new Error(`${label} rejected: ${String(result.response || 'venue error')}`);
  const statuses = result?.response?.data?.statuses;
  if (Array.isArray(statuses)) {
    const bad = statuses.find(s => s && typeof s === 'object' && s.error);
    if (bad?.error) throw new Error(`${label} rejected: ${bad.error}`);
  }
  return result;
}

export class RWAHyperliquid {
  constructor({ testnet = true } = {}) {
    this.testnet = !!testnet;
    this.master = '';
    this.metaCache = null;
    this.midCache = {};
    this.subscriptions = [];
    this.wsTransport = null;
    this.subscriptionClient = null;
  }

  setEnvironment(testnet) {
    if (!testnet && !CONFIG.mainnetEnabled) throw new Error('MAINNET is locked in this build');
    if (this.testnet === !!testnet) return;
    this.testnet = !!testnet;
    this.metaCache = null;
    this.midCache = {};
    this.stopRealtime();
  }

  async _http() {
    const { hl } = await deps();
    return new hl.HttpTransport({ isTestnet: this.testnet, timeout: CONFIG.exchangeTimeoutMs });
  }
  async _info() {
    const { hl } = await deps();
    return new hl.InfoClient({ transport: await this._http() });
  }
  async _ws() {
    if (this.wsTransport) return this.wsTransport;
    const { hl } = await deps();
    this.wsTransport = new hl.WebSocketTransport({
      isTestnet: this.testnet,
      timeout: CONFIG.exchangeTimeoutMs,
      reconnect: { maxRetries: CONFIG.reconnectMaxRetries, reconnectionDelay: CONFIG.reconnectDelayMs },
      keepAlive: { interval: CONFIG.keepAliveIntervalMs, timeout: CONFIG.keepAliveTimeoutMs },
    });
    return this.wsTransport;
  }

  async connectWallet() {
    if (!window.ethereum) throw new Error('Wallet provider not found. Install MetaMask or a compatible wallet.');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    this.master = assertAddress(accounts?.[0], 'wallet');
    return this.master;
  }

  async currentWallet() {
    if (!window.ethereum) return '';
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const a = String(accounts?.[0] || '').toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(a)) this.master = a;
    return this.master;
  }

  async _ensureArbitrum() {
    if (!window.ethereum) throw new Error('Wallet provider unavailable');
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa4b1' }] });
    } catch (error) {
      if (Number(error?.code) === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{
          chainId: '0xa4b1',
          chainName: 'Arbitrum One',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://arb1.arbitrum.io/rpc'],
          blockExplorerUrls: ['https://arbiscan.io'],
        }] });
      } else throw error;
    }
  }

  async _masterWallet() {
    const { viem, chains } = await deps();
    const master = this.master || await this.currentWallet();
    if (!master) throw new Error('Connect wallet first');
    await this._ensureArbitrum();
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const live = assertAddress(accounts?.[0], 'connected wallet');
    if (live !== master) throw new Error('Connected wallet changed. Reconnect the intended wallet.');
    return viem.createWalletClient({ account: master, chain: chains.arbitrum, transport: viem.custom(window.ethereum) });
  }

  async _masterExchange() {
    const { hl } = await deps();
    return new hl.ExchangeClient({
      transport: await this._http(),
      wallet: await this._masterWallet(),
      signatureChainId: '0xa4b1',
      defaultExpiresAfter: () => Date.now() + 15000,
    });
  }

  async meta() {
    if (this.metaCache && Date.now() - this.metaCache.ts < 60000) return this.metaCache.data;
    const info = await this._info();
    const data = await info.meta();
    this.metaCache = { ts: Date.now(), data };
    return data;
  }

  async markets() {
    const meta = await this.meta();
    return (meta?.universe || []).map((u, index) => ({
      index,
      name: u.name,
      szDecimals: Number(u.szDecimals || 0),
      maxLeverage: Number(u.maxLeverage || 1),
      onlyIsolated: !!u.onlyIsolated,
    }));
  }

  async resolveAsset(coin) {
    const markets = await this.markets();
    const asset = markets.find(m => m.name === String(coin).toUpperCase());
    if (!asset) throw new Error(`${coin} is not listed in Hyperliquid perps`);
    return asset;
  }

  async mids() {
    const info = await this._info();
    const mids = await info.allMids();
    this.midCache = mids || {};
    return this.midCache;
  }

  async mid(coin) {
    const cached = num(this.midCache?.[coin]);
    if (cached > 0) return cached;
    const mids = await this.mids();
    const mid = num(mids?.[coin]);
    if (!(mid > 0)) throw new Error(`No live mid price for ${coin}`);
    return mid;
  }

  async accountState() {
    const user = this.master || await this.currentWallet();
    if (!user) return { equity: 0, pnl: 0, positions: [], orders: [], fills: [], agents: [], dailyPnl: 0, exposure: 0 };
    const info = await this._info();
    const [state, orders, fills, agents, portfolio] = await Promise.all([
      info.clearinghouseState({ user }),
      info.openOrders({ user }),
      info.userFills({ user, aggregateByTime: true }),
      info.extraAgents({ user }).catch(() => []),
      info.portfolio({ user }).catch(() => null),
    ]);
    const positions = (state?.assetPositions || []).map(x => x?.position || x).filter(p => num(p?.szi) !== 0);
    const exposure = positions.reduce((sum, p) => sum + Math.abs(num(p?.positionValue)), 0);
    const day = Array.isArray(portfolio) ? portfolio.find(x => Array.isArray(x) && x[0] === 'day')?.[1] : null;
    const lastPnl = day?.pnlHistory?.at?.(-1);
    const dailyPnl = num(Array.isArray(lastPnl) ? lastPnl[1] : 0);
    return {
      raw: state,
      equity: num(state?.marginSummary?.accountValue),
      pnl: positions.reduce((sum, p) => sum + num(p?.unrealizedPnl), 0),
      positions,
      orders: Array.isArray(orders) ? orders : [],
      fills: Array.isArray(fills) ? fills : [],
      agents: Array.isArray(agents) ? agents : [],
      dailyPnl,
      exposure,
    };
  }

  async preflight() {
    const wallet = this.master || await this.currentWallet();
    if (!wallet) return { wallet: false, venue: false, equity: 0, agent: false, ready: false, reason: 'Connect wallet' };
    let markets = [];
    try { markets = await this.markets(); } catch (error) {
      return { wallet: true, venue: false, equity: 0, agent: false, ready: false, reason: errText(error) };
    }
    const state = await this.accountState();
    const verified = await this.verifyAgent().catch(() => ({ valid: false }));
    return {
      wallet: true,
      venue: markets.length > 0,
      marketCount: markets.length,
      equity: state.equity,
      agent: verified.valid === true,
      ready: state.equity > 0 && verified.valid === true,
      reason: state.equity <= 0 ? 'Fund Hyperliquid first' : verified.valid !== true ? 'Enable trading once' : 'Ready',
    };
  }

  async verifyAgent() {
    const user = this.master || await this.currentWallet();
    if (!user) return { valid: false, reason: 'wallet-not-connected' };
    const row = await getAgentRecord(user, this.testnet);
    if (!row) return { valid: false, reason: 'not-configured' };
    if (row.pending) return { valid: false, reason: 'approval-incomplete', row };
    if (row.expiresAt && Date.now() >= Number(row.expiresAt)) {
      await deleteAgent(user, this.testnet);
      return { valid: false, reason: 'expired' };
    }
    const info = await this._info();
    const agents = await info.extraAgents({ user });
    const remote = (Array.isArray(agents) ? agents : []).find(a => String(a?.address || '').toLowerCase() === row.address);
    const remoteExpiry = Number(remote?.validUntil || remote?.valid_until || 0);
    const valid = !!remote && (!remoteExpiry || remoteExpiry > Date.now());
    if (!valid) {
      await deleteAgent(user, this.testnet);
      return { valid: false, reason: 'not-authorized', row, remote: remote || null };
    }
    return { valid: true, row, remote };
  }

  async enableAgent() {
    const user = this.master || await this.connectWallet();
    const state = await this.accountState();
    if (!(state.equity > 0)) throw new Error('DEPOSIT REQUIRED: Hyperliquid account equity is 0. Fund the selected environment before enabling trading.');
    const existing = await this.verifyAgent().catch(() => ({ valid: false }));
    if (existing.valid) return existing;
    const { accounts } = await deps();
    const privateKey = accounts.generatePrivateKey();
    const agent = accounts.privateKeyToAccount(privateKey);
    const expiresAt = Date.now() + CONFIG.agentTtlDays * 86400000;
    const agentName = `${CONFIG.agentName} valid_until ${expiresAt}`;
    await saveAgent({ master: user, testnet: this.testnet, privateKey, address: agent.address, agentName, expiresAt, pending: true });
    try {
      const exchange = await this._masterExchange();
      assertResult(await exchange.approveAgent({ agentAddress: agent.address, agentName }), 'API wallet approval');
      await markAgentReady(user, this.testnet);
      const verified = await this.verifyAgent();
      if (!verified.valid) throw new Error('Agent approval was not confirmed by Hyperliquid');
      return verified;
    } catch (error) {
      await deleteAgent(user, this.testnet);
      throw error;
    }
  }

  async revokeAgent() {
    const user = this.master || await this.currentWallet();
    if (!user) throw new Error('Connect wallet first');
    const row = await getAgentRecord(user, this.testnet);
    if (!row) return { revoked: true, remote: false };
    const exchange = await this._masterExchange();
    assertResult(await exchange.approveAgent({ agentAddress: CONFIG.zeroAddress, agentName: row.agentName }), 'API wallet revoke');
    await deleteAgent(user, this.testnet);
    return { revoked: true, remote: true };
  }

  async _agentExchange() {
    const user = this.master || await this.currentWallet();
    if (!user) throw new Error('Connect wallet first');
    const verified = await this.verifyAgent();
    if (!verified.valid) throw new Error('API Wallet required. Enable 1-click trading before placing an order.');
    const privateKey = await loadAgentPrivateKey(user, this.testnet);
    if (!privateKey) throw new Error('API Wallet key is unavailable or expired. Re-enable trading.');
    const { hl, accounts } = await deps();
    const wallet = accounts.privateKeyToAccount(privateKey);
    if (wallet.address.toLowerCase() !== verified.row.address) throw new Error('API Wallet integrity check failed');
    return new hl.ExchangeClient({
      transport: await this._ws(),
      wallet,
      defaultExpiresAfter: () => Date.now() + 15000,
    });
  }

  async riskCheck({ coin, orderUsd, leverage }) {
    const notional = num(orderUsd);
    if (!(notional > 0)) throw new Error('Order amount must be positive');
    if (notional > CONFIG.maxOrderUsd) throw new Error(`Max order is ${formatUsd(CONFIG.maxOrderUsd)}`);
    if (!(num(leverage) >= 1 && num(leverage) <= CONFIG.maxLeverage)) throw new Error(`Leverage must be 1-${CONFIG.maxLeverage}x`);
    const state = await this.accountState();
    if (!(state.equity > 0)) throw new Error('DEPOSIT REQUIRED: account equity is 0');
    if (state.dailyPnl < -CONFIG.dailyLossUsd) throw new Error(`Daily loss limit reached (${formatUsd(CONFIG.dailyLossUsd)})`);
    if (state.exposure + notional > CONFIG.maxExposureUsd) throw new Error(`Total exposure limit exceeded (${formatUsd(CONFIG.maxExposureUsd)})`);
    const assetExposure = state.positions
      .filter(p => String(p.coin || '').toUpperCase() === String(coin).toUpperCase())
      .reduce((sum, p) => sum + Math.abs(num(p.positionValue)), 0);
    if (assetExposure + notional > CONFIG.maxPerAssetUsd) throw new Error(`Per-asset exposure limit exceeded (${formatUsd(CONFIG.maxPerAssetUsd)})`);
    return state;
  }

  async placeOrder({ coin, side, type = 'MARKET', orderUsd, leverage = 1, limitPrice = 0, tp = 0, sl = 0 }) {
    if (!this.testnet && !CONFIG.mainnetEnabled) throw new Error('MAINNET is locked');
    coin = String(coin).toUpperCase();
    const isBuy = String(side).toUpperCase() === 'BUY';
    const asset = await this.resolveAsset(coin);
    const lev = Math.min(Number(asset.maxLeverage || CONFIG.maxLeverage), num(leverage));
    await this.riskCheck({ coin, orderUsd, leverage: lev });
    const mid = await this.mid(coin);
    const utils = await import('https://esm.sh/@nktkas/hyperliquid@0.33.3/utils?target=es2022');
    const size = num(orderUsd) / mid;
    const sizeStr = utils.formatSize(size, asset.szDecimals);
    if (!(num(sizeStr) > 0)) throw new Error('Order size rounds to zero');
    let entryPrice;
    let tif;
    if (String(type).toUpperCase() === 'LIMIT') {
      if (!(num(limitPrice) > 0)) throw new Error('Enter a valid limit price');
      entryPrice = utils.formatPrice(num(limitPrice), asset.szDecimals, true);
      tif = 'Gtc';
    } else {
      const slip = CONFIG.marketSlippageBps / 10000;
      entryPrice = utils.formatPrice(mid * (1 + (isBuy ? slip : -slip)), asset.szDecimals, true);
      tif = 'Ioc';
    }
    const exchange = await this._agentExchange();
    assertResult(await exchange.updateLeverage({ asset: asset.index, isCross: true, leverage: Math.max(1, Math.round(lev)) }), 'Leverage update');
    const orders = [{ a: asset.index, b: isBuy, p: entryPrice, s: sizeStr, r: false, t: { limit: { tif } } }];
    const closeIsBuy = !isBuy;
    const tpNum = num(tp), slNum = num(sl);
    if (tpNum > 0) {
      const px = utils.formatPrice(tpNum, asset.szDecimals, true);
      orders.push({ a: asset.index, b: closeIsBuy, p: px, s: sizeStr, r: true, t: { trigger: { isMarket: true, triggerPx: px, tpsl: 'tp' } } });
    }
    if (slNum > 0) {
      const px = utils.formatPrice(slNum, asset.szDecimals, true);
      orders.push({ a: asset.index, b: closeIsBuy, p: px, s: sizeStr, r: true, t: { trigger: { isMarket: true, triggerPx: px, tpsl: 'sl' } } });
    }
    const result = assertResult(await exchange.order({ orders, grouping: orders.length > 1 ? 'normalTpsl' : 'na' }), 'Order');
    return { result, mid, entryPrice, size: sizeStr, signer: 'delegated-agent' };
  }

  async cancelOrder({ coin, oid }) {
    const asset = await this.resolveAsset(coin);
    let exchange;
    try { exchange = await this._agentExchange(); }
    catch { exchange = await this._masterExchange(); }
    return assertResult(await exchange.cancel({ cancels: [{ a: asset.index, o: Number(oid) }] }), 'Cancel');
  }

  async cancelAll() {
    const state = await this.accountState();
    for (const order of state.orders) {
      const coin = String(order.coin || order?.order?.coin || '');
      const oid = Number(order.oid || order?.order?.oid);
      if (coin && oid) await this.cancelOrder({ coin, oid });
    }
    return true;
  }

  async closePosition(position) {
    const coin = String(position?.coin || '').toUpperCase();
    const szi = num(position?.szi);
    if (!coin || !szi) return true;
    const asset = await this.resolveAsset(coin);
    const mid = await this.mid(coin);
    const utils = await import('https://esm.sh/@nktkas/hyperliquid@0.33.3/utils?target=es2022');
    const isBuy = szi < 0;
    const slip = CONFIG.marketSlippageBps / 10000;
    const px = utils.formatPrice(mid * (1 + (isBuy ? slip : -slip)), asset.szDecimals, true);
    const size = utils.formatSize(Math.abs(szi), asset.szDecimals);
    let exchange;
    try { exchange = await this._agentExchange(); }
    catch { exchange = await this._masterExchange(); }
    return assertResult(await exchange.order({ orders: [{ a: asset.index, b: isBuy, p: px, s: size, r: true, t: { limit: { tif: 'Ioc' } } }], grouping: 'na' }), 'Close position');
  }

  async withdraw({ destination, amount, confirmText }) {
    if (String(confirmText) !== 'WITHDRAW') throw new Error('High-security confirmation required: type WITHDRAW');
    destination = assertAddress(destination, 'withdrawal destination');
    amount = num(amount);
    if (!(amount > 0)) throw new Error('Withdrawal amount must be positive');
    const exchange = await this._masterExchange();
    return assertResult(await exchange.withdraw3({ destination, amount: String(amount) }), 'Withdrawal');
  }

  async startRealtime({ coin, user, onMids, onBook, onTrades, onAccount, onOrders, onFills, onError }) {
    await this.stopRealtime();
    const { hl } = await deps();
    const transport = await this._ws();
    this.subscriptionClient = new hl.SubscriptionClient({ transport });
    const safe = fn => value => { try { fn?.(value); } catch (e) { console.error(e); } };
    const opts = { onError: error => onError?.(error) };
    this.subscriptions.push(await this.subscriptionClient.allMids(safe(data => {
      const mids = data?.mids || data || {};
      this.midCache = { ...this.midCache, ...mids };
      onMids?.(mids);
    }), opts));
    this.subscriptions.push(await this.subscriptionClient.l2Book({ coin }, safe(onBook), opts));
    this.subscriptions.push(await this.subscriptionClient.trades({ coin }, safe(onTrades), opts));
    if (user) {
      const methods = [
        ['clearinghouseState', { user }, onAccount],
        ['openOrders', { user }, onOrders],
        ['userFills', { user, aggregateByTime: true }, onFills],
      ];
      for (const [name, args, cb] of methods) {
        if (typeof this.subscriptionClient[name] === 'function') {
          try { this.subscriptions.push(await this.subscriptionClient[name](args, safe(cb), opts)); }
          catch (error) { onError?.(error); }
        }
      }
    }
    return true;
  }

  async stopRealtime() {
    const subs = this.subscriptions.splice(0);
    for (const sub of subs) {
      try { await sub?.unsubscribe?.(); } catch {}
    }
    this.subscriptionClient = null;
    if (this.wsTransport?.[Symbol.asyncDispose]) {
      try { await this.wsTransport[Symbol.asyncDispose](); } catch {}
    }
    this.wsTransport = null;
  }
}

export { CONFIG, errText };
