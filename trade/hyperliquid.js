import { CONFIG } from './config.js';

let depsPromise;
async function deps() {
  if (!depsPromise) {
    depsPromise = import(CONFIG.sdkUrl).then(hl => ({ hl }));
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
function formatUsd(n) { return `$${num(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
function errText(error) {
  return String(error?.cause?.message || error?.shortMessage || error?.details || error?.message || error || 'Unknown error');
}

const SESSION_KEY = 'rwa_wallet_link_v1';
let executionPromise;
async function executionApi() {
  if (window.RWAExecutionAPI?.version === '2.0.0') return window.RWAExecutionAPI;
  if (!executionPromise) {
    executionPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-rwa-trade-execution]');
      if (existing) {
        existing.addEventListener('load', () => window.RWAExecutionAPI ? resolve(window.RWAExecutionAPI) : reject(new Error('RWA Execution API failed to initialize')), { once: true });
        existing.addEventListener('error', () => reject(new Error('RWA Execution API failed to load')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = '../execution-api.js?v=3';
      script.async = true;
      script.dataset.rwaTradeExecution = '1';
      script.onload = () => window.RWAExecutionAPI ? resolve(window.RWAExecutionAPI) : reject(new Error('RWA Execution API failed to initialize'));
      script.onerror = () => reject(new Error('RWA Execution API failed to load'));
      document.head.appendChild(script);
    }).catch(error => { executionPromise = null; throw error; });
  }
  return executionPromise;
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

  async _execution() {
    const api = await executionApi();
    if (!api || api.version !== '2.0.0') throw new Error('RWA Execution API is not ready');
    return api;
  }

  _syncSession(wallet) {
    const address = assertAddress(wallet, 'wallet');
    let row = {};
    try { row = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}') || {}; } catch {}
    row.wallet = address;
    row.provider = row.provider || 'injected';
    row.connectedAt = row.connectedAt || Date.now();
    row.lastSeenAt = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(row));
    window.RWAProvider = window.ethereum;
    this.master = address;
    return address;
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
    return this._syncSession(accounts?.[0]);
  }

  async currentWallet() {
    if (!window.ethereum) return '';
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    const address = String(accounts?.[0] || '').toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(address)) return this._syncSession(address);
    this.master = '';
    return '';
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
    if (!asset) throw new Error(`${coin} is not listed in this market`);
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

  async verifyAgent() {
    const user = this.master || await this.currentWallet();
    if (!user) return { valid: false, reason: 'wallet-not-connected' };
    const api = await this._execution();
    const verified = await api.agent.verify(this.testnet, { force: true });
    return verified || { valid: false, reason: 'verification-failed' };
  }

  async _requireAgent() {
    const api = await this._execution();
    const verified = await api.agent.verify(this.testnet, { force: true });
    if (verified?.valid !== true) throw new Error('1-click trading is not enabled. Enable trading once before placing an order.');
    const account = await api.agent.account(this.testnet);
    if (!account) throw new Error('1-click trading key is unavailable. Re-enable trading.');
    const local = String(account.address || '').toLowerCase();
    const expected = String(verified?.row?.address || verified?.remote?.address || '').toLowerCase();
    if (!local || !expected || local !== expected) throw new Error('Trading authorization integrity check failed');
    return { api, verified, account };
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
      reason: state.equity <= 0 ? 'Get test balance first' : verified.valid !== true ? 'Enable trading once' : 'Ready',
    };
  }

  async enableAgent() {
    const user = this.master || await this.connectWallet();
    this._syncSession(user);
    const state = await this.accountState();
    if (!(state.equity > 0)) throw new Error('TEST BALANCE REQUIRED: get TESTNET balance before enabling trading.');
    const existing = await this.verifyAgent().catch(() => ({ valid: false }));
    if (existing.valid) return existing;
    const api = await this._execution();
    await api.agent.authorize(this.testnet);
    const verified = await api.agent.verify(this.testnet, { force: true });
    if (verified?.valid !== true) throw new Error('Trading approval was not confirmed by the TESTNET network');
    return verified;
  }

  async revokeAgent() {
    const user = this.master || await this.currentWallet();
    if (!user) throw new Error('Connect wallet first');
    const api = await this._execution();
    return api.agent.revoke(this.testnet);
  }

  async riskCheck({ coin, orderUsd, leverage }) {
    const notional = num(orderUsd);
    if (!(notional > 0)) throw new Error('Order amount must be positive');
    if (notional > CONFIG.maxOrderUsd) throw new Error(`Max order is ${formatUsd(CONFIG.maxOrderUsd)}`);
    if (!(num(leverage) >= 1 && num(leverage) <= CONFIG.maxLeverage)) throw new Error(`Leverage must be 1-${CONFIG.maxLeverage}x`);
    const state = await this.accountState();
    if (!(state.equity > 0)) throw new Error('TEST BALANCE REQUIRED: account equity is 0');
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
    const asset = await this.resolveAsset(coin);
    const lev = Math.min(Number(asset.maxLeverage || CONFIG.maxLeverage), num(leverage));
    await this.riskCheck({ coin, orderUsd, leverage: lev });
    const mid = await this.mid(coin);
    const size = num(orderUsd) / mid;
    if (!(size > 0)) throw new Error('Order size is invalid');
    const { api } = await this._requireAgent();
    const args = {
      coin,
      side: String(side).toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      size,
      leverage: Math.max(1, Math.round(lev)),
      testnet: this.testnet,
      preferAgent: true,
    };
    const tpNum = num(tp), slNum = num(sl);
    let out;
    if (tpNum > 0 || slNum > 0) {
      out = await api.orders.bracket({
        ...args,
        type: String(type).toUpperCase() === 'LIMIT' ? 'LIMIT' : 'MARKET',
        price: String(type).toUpperCase() === 'LIMIT' ? num(limitPrice) : null,
        tp: tpNum || null,
        sl: slNum || null,
      });
    } else if (String(type).toUpperCase() === 'LIMIT') {
      if (!(num(limitPrice) > 0)) throw new Error('Enter a valid limit price');
      out = await api.orders.limit({ ...args, price: num(limitPrice), tif: 'Gtc' });
    } else {
      out = await api.orders.market(args);
    }
    if (out?.mode && out.mode !== 'agent') throw new Error('SECURITY BLOCK: order authorization was not delegated');
    return { ...out, mid, signer: 'delegated-agent' };
  }

  async cancelOrder({ coin, oid }) {
    const api = await this._execution();
    return api.orders.cancel({ coin, oid, testnet: this.testnet, preferAgent: true });
  }

  async cancelAll() {
    const api = await this._execution();
    return api.orders.cancelAll({ testnet: this.testnet, preferAgent: true });
  }

  async closePosition(position) {
    const coin = String(position?.coin || '').toUpperCase();
    const szi = num(position?.szi);
    if (!coin || !szi) return true;
    const api = await this._execution();
    return api.orders.market({
      coin,
      side: szi > 0 ? 'SELL' : 'BUY',
      size: Math.abs(szi),
      reduceOnly: true,
      leverage: 1,
      testnet: this.testnet,
      preferAgent: true,
    });
  }

  async withdraw() {
    throw new Error('Withdrawal is intentionally disabled in this TESTNET-only terminal. It will remain disabled until the global launch gate permits production withdrawals.');
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
