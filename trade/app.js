import { RWAHyperliquid, CONFIG, errText } from './hyperliquid.js';

const $ = id => document.getElementById(id);
const app = new RWAHyperliquid({ testnet: true });
let wallet = '';
let currentCoin = 'BTC';
let currentMarkPrice = 0;
let accountPoll = null;
let realtimeSeq = 0;

function toast(message, type = '') {
  const el = $('toast');
  el.textContent = String(message);
  el.className = `toast show ${type}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.className = 'toast'; }, 4200);
}
function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : 'Connect'; }
function money(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? Math.min(4, digits) : 2, maximumFractionDigits: n < 1 ? 6 : digits })}`;
}
function qty(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
function time(v) {
  const n = Number(v);
  return Number.isFinite(n) ? new Date(n).toLocaleTimeString() : '—';
}
function busy(button, yes, label) {
  if (!button) return;
  if (yes) { button.dataset.old = button.textContent; button.textContent = label || 'Working…'; button.disabled = true; }
  else { button.textContent = button.dataset.old || button.textContent; button.disabled = false; }
}

async function boot() {
  $('version').textContent = `${CONFIG.version} · ${CONFIG.build}`;
  $('diagMainnet').textContent = CONFIG.mainnetEnabled ? 'ENABLED' : 'LOCKED';
  $('mainnetLockText').textContent = CONFIG.mainnetEnabled ? 'Mainnet enabled by release policy.' : 'Mainnet is hard-locked in this build. TESTNET is the only trading environment.';
  $('testnetToggle').checked = true;
  $('testnetToggle').disabled = !CONFIG.mainnetEnabled;
  $('networkBadge').textContent = 'TESTNET';
  wallet = await app.currentWallet();
  await loadMarkets();
  bind();
  if (wallet) await afterWallet();
  else renderSetup(null);
  await restartRealtime();
  updatePreview();
}

function bind() {
  $('walletBtn').addEventListener('click', async () => {
    try {
      busy($('walletBtn'), true, 'Connecting…');
      wallet = await app.connectWallet();
      await afterWallet();
      toast('Wallet connected', 'success');
    } catch (e) { toast(errText(e), 'error'); }
    finally { busy($('walletBtn'), false); }
  });

  $('fundBtn').addEventListener('click', () => {
    window.RWAFundingPanel?.open?.();
  });

  $('enableTradingBtn').addEventListener('click', async () => {
    const b = $('enableTradingBtn');
    try {
      busy(b, true, 'Approve once in wallet…');
      await app.enableAgent();
      toast('1-click trading enabled', 'success');
      await refreshAll();
    } catch (e) { toast(errText(e), 'error'); }
    finally { busy(b, false); }
  });

  $('revokeAgentBtn').addEventListener('click', async () => {
    if (!confirm('Disable 1-click trading? New entries will stop until trading is enabled again.')) return;
    const b = $('revokeAgentBtn');
    try {
      busy(b, true, 'Disabling…');
      await app.revokeAgent();
      toast('1-click trading disabled', 'success');
      await refreshAll();
    } catch (e) { toast(errText(e), 'error'); }
    finally { busy(b, false); }
  });

  $('testnetToggle').addEventListener('change', async () => {
    const wantsTestnet = $('testnetToggle').checked;
    try {
      app.setEnvironment(wantsTestnet);
      currentMarkPrice = 0;
      $('networkBadge').textContent = wantsTestnet ? 'TESTNET' : 'MAINNET';
      $('networkBadge').className = `network-badge ${wantsTestnet ? 'testnet' : 'mainnet'}`;
      await loadMarkets();
      await refreshAll();
      await restartRealtime();
    } catch (e) {
      $('testnetToggle').checked = true;
      toast(errText(e), 'error');
    }
  });

  $('coin').addEventListener('change', async () => {
    currentCoin = $('coin').value;
    currentMarkPrice = 0;
    $('marketName').textContent = `${currentCoin}-PERP`;
    $('marketPrice').textContent = '—';
    await restartRealtime();
    updatePreview();
  });
  $('orderType').addEventListener('change', () => {
    $('limitWrap').hidden = $('orderType').value !== 'LIMIT';
    updatePreview();
  });
  ['side','orderUsd','leverage','limitPrice','tp','sl'].forEach(id => $(id).addEventListener('input', updatePreview));
  $('side').addEventListener('change', updatePreview);

  $('tradeBtn').addEventListener('click', submitTrade);
  $('refreshBtn').addEventListener('click', refreshAll);
  $('cancelAllBtn').addEventListener('click', async () => {
    if (!confirm('Cancel all open orders?')) return;
    try { busy($('cancelAllBtn'), true, 'Cancelling…'); await app.cancelAll(); toast('Open orders cancelled', 'success'); await refreshAccount(); }
    catch (e) { toast(errText(e), 'error'); }
    finally { busy($('cancelAllBtn'), false); }
  });
  $('withdrawBtn').addEventListener('click', withdrawFlow);
  $('preflightBtn').addEventListener('click', runPreflight);

  window.addEventListener('rwa:funding-changed', () => {
    if (wallet) refreshAll().catch(() => {});
  });

  window.ethereum?.on?.('accountsChanged', async accounts => {
    wallet = String(accounts?.[0] || '').toLowerCase();
    if (!wallet) {
      app.master = '';
      stopAccountPoll();
      renderSetup(null);
      await restartRealtime();
      return;
    }
    app.master = wallet;
    await afterWallet();
    await restartRealtime();
  });
}

async function loadMarkets() {
  try {
    const markets = await app.markets();
    const preferred = ['BTC','ETH','SOL','HYPE','XRP','DOGE','SUI','AVAX','LINK'];
    markets.sort((a,b) => {
      const ia = preferred.indexOf(a.name), ib = preferred.indexOf(b.name);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return a.name.localeCompare(b.name);
    });
    $('coin').innerHTML = markets.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}-PERP · max ${m.maxLeverage}x</option>`).join('');
    if (markets.some(m => m.name === currentCoin)) $('coin').value = currentCoin;
    else { currentCoin = markets[0]?.name || 'BTC'; $('coin').value = currentCoin; }
    $('marketName').textContent = `${currentCoin}-PERP`;
    $('diagVenue').textContent = `PASS · ${markets.length} perps`;
  } catch (e) {
    $('diagVenue').textContent = 'ERROR';
    toast(`Market metadata: ${errText(e)}`, 'error');
  }
}

async function afterWallet() {
  $('walletBtn').textContent = short(wallet);
  $('diagWallet').textContent = `PASS · ${short(wallet)}`;
  startAccountPoll();
  await refreshAll();
}

async function runPreflight() {
  try {
    busy($('preflightBtn'), true, 'Checking…');
    const p = await app.preflight();
    $('diagWallet').textContent = p.wallet ? `PASS · ${short(wallet)}` : 'ACTION';
    $('diagVenue').textContent = p.venue ? `PASS · ${p.marketCount} perps` : 'ERROR';
    $('diagCollateral').textContent = p.equity > 0 ? `PASS · ${money(p.equity)}` : 'ACTION · equity 0';
    $('diagAgent').textContent = p.agent ? 'PASS · delegated' : 'ACTION · setup';
    toast(p.ready ? 'Preflight PASS — trading ready' : p.reason, p.ready ? 'success' : '');
  } catch (e) { toast(errText(e), 'error'); }
  finally { busy($('preflightBtn'), false); }
}

async function refreshAll() {
  if (!wallet) return renderSetup(null);
  await Promise.allSettled([refreshAccount(), runSetupCheck()]);
}

async function runSetupCheck() {
  const p = await app.preflight();
  renderSetup(p);
}

function renderSetup(p) {
  const connected = !!wallet;
  const funded = !!p && p.equity > 0;
  const agent = !!p && p.agent;
  $('stepWallet').className = `step ${connected ? 'done' : 'active'}`;
  $('stepWalletValue').textContent = connected ? short(wallet) : 'Connect';
  $('stepFund').className = `step ${funded ? 'done' : connected ? 'active' : ''}`;
  $('stepFundValue').textContent = funded ? money(p.equity) : 'Required';
  $('stepAgent').className = `step ${agent ? 'done' : funded ? 'active' : ''}`;
  $('stepAgentValue').textContent = agent ? 'Enabled' : 'Enable once';
  $('agentMode').textContent = agent ? 'READY' : 'SETUP REQUIRED';
  $('agentMode').className = `mode-badge ${agent ? 'ready' : ''}`;
  $('fundBtn').hidden = !connected || funded;
  $('enableTradingBtn').hidden = !connected || !funded || agent;
  $('revokeAgentBtn').hidden = !agent;
  $('status').textContent = !connected ? 'Connect wallet' : !funded ? 'Test balance required' : !agent ? 'Enable trading once' : 'Trading ready';
  $('previewSigner').textContent = agent ? 'Ready' : 'Not ready';
  $('tradeBtn').disabled = !agent;
  $('tradeBtn').textContent = !connected ? 'Connect wallet' : !funded ? 'Get test balance first' : !agent ? 'Enable trading first' : `${$('side').value} ${currentCoin}`;
  $('diagCollateral').textContent = !p ? '—' : funded ? `PASS · ${money(p.equity)}` : 'ACTION · equity 0';
  $('diagAgent').textContent = agent ? 'PASS · delegated' : connected ? 'ACTION · setup' : '—';
}

async function refreshAccount() {
  if (!wallet) return;
  const state = await app.accountState();
  renderAccountState(state);
}

function renderAccountState(state) {
  $('equity').textContent = money(state.equity);
  $('pnl').textContent = money(state.pnl);
  const pos = state.positions.find(p => String(p.coin).toUpperCase() === currentCoin);
  $('position').textContent = pos ? `${Number(pos.szi) > 0 ? 'LONG' : 'SHORT'} ${qty(Math.abs(Number(pos.szi)))}` : 'FLAT';
  $('positionsBody').innerHTML = state.positions.length ? state.positions.map(p => `
    <tr><td>${escapeHtml(p.coin)}</td><td>${Number(p.szi) >= 0 ? 'LONG' : 'SHORT'}</td><td>${qty(Math.abs(Number(p.szi)))}</td><td>${money(p.entryPx)}</td><td>${money(p.unrealizedPnl)}</td><td><button class="mini danger" data-close="${escapeHtml(p.coin)}">Close</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No open positions.</td></tr>';
  $('positionsBody').querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', async () => {
    const p = state.positions.find(x => x.coin === btn.dataset.close); if (!p) return;
    if (!confirm(`Close ${p.coin} position at market?`)) return;
    try { btn.disabled = true; await app.closePosition(p); toast(`${p.coin} close submitted`, 'success'); await refreshAccount(); }
    catch (e) { toast(errText(e), 'error'); } finally { btn.disabled = false; }
  }));
  $('ordersBody').innerHTML = state.orders.length ? state.orders.map(o => `
    <tr><td>${escapeHtml(o.coin || '')}</td><td>${o.side || (o.isBuy ? 'BUY' : 'SELL')}</td><td>${money(o.limitPx || o.px)}</td><td>${qty(o.sz)}</td><td><button class="mini" data-cancel="${Number(o.oid)}" data-coin="${escapeHtml(o.coin || '')}">Cancel</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">No open orders.</td></tr>';
  $('ordersBody').querySelectorAll('[data-cancel]').forEach(btn => btn.addEventListener('click', async () => {
    try { btn.disabled = true; await app.cancelOrder({ coin: btn.dataset.coin, oid: btn.dataset.cancel }); toast('Order cancelled', 'success'); await refreshAccount(); }
    catch (e) { toast(errText(e), 'error'); } finally { btn.disabled = false; }
  }));
  $('fillsBody').innerHTML = state.fills.slice(0, 50).map(f => `
    <tr><td>${escapeHtml(f.coin || '')}</td><td>${escapeHtml(f.side || '')}</td><td>${money(f.px)}</td><td>${qty(f.sz)}</td><td>${time(f.time)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No fills yet.</td></tr>';
}

async function restartRealtime() {
  const seq = ++realtimeSeq;
  try {
    await app.startRealtime({
      coin: currentCoin,
      user: wallet || '',
      onMids: mids => {
        if (seq !== realtimeSeq) return;
        const px = Number(mids?.[currentCoin]);
        if (px > 0) {
          currentMarkPrice = px;
          $('marketPrice').textContent = money(px);
          updatePreview();
        }
      },
      onBook: data => seq === realtimeSeq && renderBook(data),
      onTrades: data => seq === realtimeSeq && renderTrades(data),
      onAccount: () => wallet && refreshAccount().catch(() => {}),
      onOrders: () => wallet && refreshAccount().catch(() => {}),
      onFills: () => wallet && refreshAccount().catch(() => {}),
      onError: error => console.warn('Realtime stream error', error),
    });
  } catch (e) {
    console.warn('Realtime unavailable; REST refresh remains active', e);
    try {
      const px = await app.mid(currentCoin);
      currentMarkPrice = Number(px) || 0;
      $('marketPrice').textContent = money(px);
      updatePreview();
      const info = await app._info();
      renderBook(await info.l2Book({ coin: currentCoin }));
    } catch {}
  }
}

function renderBook(data) {
  const levels = data?.levels || [];
  const bids = Array.isArray(levels[0]) ? levels[0].slice(0, 10) : [];
  const asks = Array.isArray(levels[1]) ? levels[1].slice(0, 10) : [];
  $('asks').innerHTML = asks.slice().reverse().map(l => `<div class="book-row ask"><span>${money(l.px)}</span><span>${qty(l.sz)}</span></div>`).join('') || '<div class="empty">No asks</div>';
  $('bids').innerHTML = bids.map(l => `<div class="book-row bid"><span>${money(l.px)}</span><span>${qty(l.sz)}</span></div>`).join('') || '<div class="empty">No bids</div>';
  $('bestBid').textContent = bids[0] ? money(bids[0].px) : '—';
  $('bestAsk').textContent = asks[0] ? money(asks[0].px) : '—';
}

function renderTrades(data) {
  const trades = Array.isArray(data) ? data : Array.isArray(data?.trades) ? data.trades : [];
  if (!trades.length) return;
  const existing = Array.from($('tape').querySelectorAll('.tape-row')).map(x => x.outerHTML);
  const fresh = trades.slice(-20).reverse().map(t => `<div class="tape-row ${String(t.side).toUpperCase() === 'B' ? 'buy' : 'sell'}"><span>${money(t.px)}</span><span>${qty(t.sz)}</span><small>${time(t.time)}</small></div>`);
  $('tape').innerHTML = [...fresh, ...existing].slice(0, 40).join('');
}

function updatePreview() {
  const usd = Number($('orderUsd').value || 0);
  const price = Number(currentMarkPrice);
  $('previewSide').textContent = `${$('side').value} ${currentCoin}`;
  $('previewNotional').textContent = money(usd);
  $('previewSize').textContent = price > 0 ? qty(usd / price) : '—';
  const tp = Number($('tp').value || 0), sl = Number($('sl').value || 0);
  $('previewProtection').textContent = tp || sl ? `${tp ? 'TP '+money(tp) : ''}${tp && sl ? ' · ' : ''}${sl ? 'SL '+money(sl) : ''}` : 'None';
  if (!$('tradeBtn').disabled) $('tradeBtn').textContent = `${$('side').value} ${currentCoin}`;
}

async function submitTrade() {
  const b = $('tradeBtn');
  const params = {
    coin: currentCoin,
    side: $('side').value,
    type: $('orderType').value,
    orderUsd: Number($('orderUsd').value),
    leverage: Number($('leverage').value),
    limitPrice: Number($('limitPrice').value || 0),
    tp: Number($('tp').value || 0),
    sl: Number($('sl').value || 0),
  };
  if (!confirm(`${params.side} ${currentCoin} for ${money(params.orderUsd)} at ${params.leverage}x${params.tp || params.sl ? ' with TP/SL' : ''}?`)) return;
  try {
    busy(b, true, 'Submitting…');
    await app.placeOrder(params);
    toast('Order accepted', 'success');
    await refreshAccount();
  } catch (e) { toast(errText(e), 'error'); }
  finally { busy(b, false); renderSetup(await app.preflight().catch(() => null)); }
}

async function withdrawFlow() {
  if (!wallet) return toast('Connect wallet first', 'error');
  const amount = prompt('Withdrawal amount (USDC):');
  if (amount == null) return;
  const destination = prompt('Destination EVM address:', wallet);
  if (destination == null) return;
  if (!confirm(`Withdraw ${amount} USDC to ${destination}? A fresh wallet confirmation is required.`)) return;
  const phrase = prompt('For security, type exactly: WITHDRAW');
  if (phrase == null) return;
  try {
    busy($('withdrawBtn'), true, 'Confirm in wallet…');
    await app.withdraw({ destination, amount, confirmText: phrase });
    toast('Withdrawal submitted', 'success');
  } catch (e) { toast(errText(e), 'error'); }
  finally { busy($('withdrawBtn'), false); }
}

function startAccountPoll() {
  stopAccountPoll();
  accountPoll = setInterval(() => refreshAccount().catch(() => {}), 15000);
}
function stopAccountPoll() { if (accountPoll) clearInterval(accountPoll); accountPoll = null; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}

boot().catch(error => {
  console.error(error);
  $('status').textContent = 'Startup error';
  toast(`Startup error: ${errText(error)}`, 'error');
});
