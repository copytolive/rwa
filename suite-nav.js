(()=>{
const nav=document.querySelector('.mobile-tabs');
if(nav){nav.innerHTML='<a href="#markets" data-mobile-nav="markets"><span>⌕</span><small>Markets</small></a><a class="active" href="#terminal" data-mobile-nav="chart"><span>⌁</span><small>Chart</small></a><a href="#social" data-mobile-nav="social"><span>◎</span><small>Social</small></a><a href="#suite" data-mobile-nav="hub"><span>◇</span><small>Hub</small></a><a href="#suite" data-mobile-nav="portfolio"><span>▣</span><small>Portfolio</small></a>';nav.style.setProperty('grid-template-columns','repeat(5,1fr)','important')}
const ptab=document.querySelector('[data-suite-tab="profile"]');if(ptab)ptab.textContent='Account + P&L';
const rwaTab=document.querySelector('[data-suite-tab="rwa"]');if(rwaTab)rwaTab.textContent='RWA Factory';
const autoWalletLogin=!!document.activeElement?.matches?.('.signin');
function hideSuite(){document.body.classList.remove('suite-open');const s=document.getElementById('suite');if(s)s.style.display='none'}
function installGlobalRwaFactory(){const panel=document.querySelector('[data-suite-panel="rwa"]');if(!panel||panel.querySelector('[data-global-rwa-factory]'))return false;const legacy=panel.querySelector('.suite-grid');const wrap=document.createElement('section');wrap.className='suite-card span-12';wrap.dataset.globalRwaFactory='1';wrap.style.cssText='margin:0 0 14px;min-height:780px;padding:0;overflow:hidden;border-color:#33445d;background:#090d13';wrap.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #263142"><div><small style="letter-spacing:.12em;color:#8ab4ff;font-weight:800">P21 · GLOBAL RWA FACTORY · 8 ENGINES</small><h3 style="margin:3px 0 0">Create My RWA</h3></div><span style="font-size:11px;color:#60d394">REGISTER → VERIFY → VALUE → FINANCE → TOKENIZE → TRADE</span></div><iframe title="Global RWA Factory" src="rwa-8-engines/?embed=1" loading="lazy" style="display:block;width:100%;height:900px;border:0;background:#080b10"></iframe>';if(legacy)panel.insertBefore(wrap,legacy);else panel.appendChild(wrap);return true}
function suite(tab){if(!window.RWASuite)return;if(tab==='rwa')installGlobalRwaFactory();window.RWASuite.open(tab);if(tab==='rwa')setTimeout(installGlobalRwaFactory,80);const s=document.getElementById('suite');if(innerWidth>680&&s)setTimeout(()=>s.scrollIntoView({behavior:'smooth',block:'start'}),20)}
function openMarketplace(){location.href='marketplace-v2.html'}
document.addEventListener('click',e=>{if(e.target.closest('[data-suite-close]')){e.preventDefault();hideSuite();if(innerWidth>680)document.getElementById('terminal')?.scrollIntoView({behavior:'smooth',block:'start'})}});
for(const b of document.querySelectorAll('.topnav button')){const t=b.textContent.trim().toLowerCase();if(t==='markets')b.onclick=()=>{hideSuite();document.getElementById('terminal')?.scrollIntoView({behavior:'smooth'})};if(t==='intelligence')b.onclick=()=>suite('intel');if(t==='assets')b.onclick=()=>suite('rwa');if(t==='research')b.onclick=()=>suite('feed');if(t==='company')b.onclick=()=>suite('profile')}
for(const b of document.querySelectorAll('.product-nav button')){const t=b.textContent.trim().toLowerCase();if(t.includes('rwa index'))b.onclick=()=>suite('intel');if(t.includes('asset marketplace'))b.onclick=openMarketplace;if(t.includes('research'))b.onclick=()=>suite('feed')}
const sign=document.querySelector('.signin');if(sign){sign.textContent='Connect Wallet';sign.onclick=()=>suite('profile')}const inst=document.querySelector('.institutional');if(inst){inst.textContent='Create RWA';inst.onclick=()=>suite('rwa')}
setTimeout(installGlobalRwaFactory,0);setTimeout(installGlobalRwaFactory,600);
if(!document.querySelector('link[data-rwa-ops-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='ops.css?v=1';l.dataset.rwaOpsCss='1';document.head.appendChild(l)}
function load(src,key){if(document.querySelector(`script[data-rwa-${key}]`))return;const base=src.split('?')[0];if([...document.scripts].some(s=>(s.getAttribute('src')||'').split('?')[0]===base))return;const s=document.createElement('script');s.src=src;s.async=false;s.dataset[`rwa${key.replace(/(^|-)(\w)/g,(_,a,b)=>b.toUpperCase())}`]='1';document.body.appendChild(s)}
load('walletconnect.js?v=4','walletconnect');
/* wallet-core.js v3 is the only auth owner and is loaded by index.html. */
/* Single write-path: API and capture bridge register before secondary UI handlers. */
load('execution-api.js?v=4','execution-api');
load('execution-ops-bridge.js?v=4','execution-ops');
load('ops-suite.js?v=2','ops');
load('rwa-verification-evidence.js?v=1','rwa-evidence');
load('risk-hardening.js?v=1','risk-hardening');
load('provider-failover.js?v=2','failover');
load('monitor-client.js?v=2','monitor-client');
load('monitor-config-client.js?v=1','monitor-config-client');
load('social-safety-patch.js?v=2','social-safety');
load('execution-ui.js?v=3','execution-ui');
load('suite-execution-patch.js?v=6','exec-patch');
load('audit-hooks.js?v=2','audit-hooks');
load('rwa-verify-client.js?v=2','rwa-verify');
load('copy-24x7-client.js?v=2','copy-24x7');
load('launch-status.js?v=2','launch-status');
load('beta-proof-client.js?v=1','beta-proof');
if(autoWalletLogin){let n=0;const timer=setInterval(()=>{n++;if(window.RWAWalletAuth?.login){clearInterval(timer);window.RWAWalletAuth.login().catch?.(e=>console.warn('Wallet login',e))}else if(n>80)clearInterval(timer)},50)}
})();
