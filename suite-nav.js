(()=>{
const nav=document.querySelector('.mobile-tabs');
if(nav){nav.innerHTML='<a href="#markets" data-mobile-nav="markets"><span>⌕</span><small>Markets</small></a><a class="active" href="#terminal" data-mobile-nav="chart"><span>⌁</span><small>Chart</small></a><a href="#social" data-mobile-nav="social"><span>◎</span><small>Social</small></a><a href="#suite" data-mobile-nav="hub"><span>◇</span><small>Hub</small></a><a href="#suite" data-mobile-nav="portfolio"><span>▣</span><small>Portfolio</small></a>';nav.style.setProperty('grid-template-columns','repeat(5,1fr)','important')}
const ptab=document.querySelector('[data-suite-tab="profile"]');if(ptab)ptab.textContent='Account + P&L';
const autoWalletLogin=!!document.activeElement?.matches?.('.signin');
function hideSuite(){document.body.classList.remove('suite-open');const s=document.getElementById('suite');if(s)s.style.display='none'}
function suite(tab){if(!window.RWASuite)return;window.RWASuite.open(tab);const s=document.getElementById('suite');if(innerWidth>680&&s)setTimeout(()=>s.scrollIntoView({behavior:'smooth',block:'start'}),20)}
document.addEventListener('click',e=>{if(e.target.closest('[data-suite-close]')){e.preventDefault();hideSuite();if(innerWidth>680)document.getElementById('terminal')?.scrollIntoView({behavior:'smooth',block:'start'})}});
for(const b of document.querySelectorAll('.topnav button')){const t=b.textContent.trim().toLowerCase();if(t==='markets')b.onclick=()=>{hideSuite();document.getElementById('terminal')?.scrollIntoView({behavior:'smooth'})};if(t==='intelligence')b.onclick=()=>suite('intel');if(t==='assets')b.onclick=()=>suite('rwa');if(t==='research')b.onclick=()=>suite('feed');if(t==='company')b.onclick=()=>suite('profile')}
for(const b of document.querySelectorAll('.product-nav button')){const t=b.textContent.trim().toLowerCase();if(t.includes('rwa index'))b.onclick=()=>suite('intel');if(t.includes('asset marketplace'))b.onclick=()=>suite('rwa');if(t.includes('research'))b.onclick=()=>suite('feed')}
const sign=document.querySelector('.signin');if(sign){sign.textContent='Connect Wallet';sign.onclick=()=>suite('profile')}const inst=document.querySelector('.institutional');if(inst)inst.onclick=()=>suite('rwa');
if(!document.querySelector('link[data-rwa-ops-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='ops.css?v=1';l.dataset.rwaOpsCss='1';document.head.appendChild(l)}
function load(src,key){if(document.querySelector(`script[data-rwa-${key}]`))return;const s=document.createElement('script');s.src=src;s.async=false;s.dataset[`rwa${key.replace(/(^|-)(\w)/g,(_,a,b)=>b.toUpperCase())}`]='1';document.body.appendChild(s)}
load('walletconnect.js?v=2','walletconnect');
/* Single write-path: API and capture bridge register before legacy UI handlers. */
load('execution-api.js?v=2','execution-api');
load('execution-ops-bridge.js?v=2','execution-ops');
load('ops-suite.js?v=1','ops');
load('risk-hardening.js?v=1','risk-hardening');
load('provider-failover.js?v=2','failover');
load('monitor-client.js?v=2','monitor-client');
load('monitor-config-client.js?v=1','monitor-config-client');
load('social-safety-patch.js?v=2','social-safety');
load('execution-ui.js?v=2','execution-ui');
load('suite-execution-patch.js?v=5','exec-patch');
load('wallet-auth.js?v=2','wallet-auth');
load('walletconnect-auth-patch.js?v=1','walletconnect-auth-patch');
load('audit-hooks.js?v=2','audit-hooks');
load('rwa-verify-client.js?v=1','rwa-verify');
if(autoWalletLogin){let n=0;const timer=setInterval(()=>{n++;if(window.RWAWalletAuth?.login){clearInterval(timer);window.RWAWalletAuth.login().catch?.(e=>console.warn('Wallet login',e))}else if(n>80)clearInterval(timer)},50)}
})();