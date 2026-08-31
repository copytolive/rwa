import fs from 'node:fs';
import { verifyMessage } from 'ethers';
const fail=msg=>{fs.writeFileSync('monitor-config-error.txt',String(msg));console.error(msg);process.exit(1)};
try{
  const body=process.env.ISSUE_BODY||'',m=body.match(/```json\s*([\s\S]*?)```/i);if(!m)fail('Missing JSON config package');
  const pkg=JSON.parse(m[1]),p=pkg?.payload||{};if(!p.admin||!pkg.message||!pkg.signature)fail('Incomplete config package');
  const expected=`RWA 24X7 CONFIG\n${JSON.stringify(p)}`;if(pkg.message!==expected)fail('Config message does not match payload');
  const recovered=verifyMessage(pkg.message,pkg.signature).toLowerCase(),admin=String(p.admin).toLowerCase();if(recovered!==admin)fail('Admin wallet signature mismatch');
  const admins=(JSON.parse(fs.readFileSync('monitor/admin-wallets.json','utf8')).admins||[]).map(x=>typeof x==='string'?x:x.wallet).filter(Boolean).map(x=>String(x).toLowerCase());if(!admins.includes(admin))fail('Wallet is not authorized to publish monitor config');
  if(p.execution!=='wallet-signature-required')fail('Execution mode must remain wallet-signature-required');
  const allowed=new Set(['price_above','price_below','change_abs','volume_min','breakout']);
  const alerts=(Array.isArray(p.alerts)?p.alerts:[]).slice(0,100).map((a,i)=>({id:String(a.id||`alert-${i}`),symbol:String(a.symbol||'').toUpperCase(),type:String(a.type||''),threshold:Number(a.threshold||0),baseline_high:Number(a.baseline_high||0)})).filter(a=>a.symbol&&allowed.has(a.type)&&Number.isFinite(a.threshold));
  const copy_targets=(Array.isArray(p.copy_targets)?p.copy_targets:[]).slice(0,20).map(c=>({wallet:String(c.wallet||'').toLowerCase(),since_ms:Number(c.since_ms||Date.now()-3600000)})).filter(c=>/^0x[a-f0-9]{40}$/.test(c.wallet));
  const config={enabled:true,alerts,copy_targets,execution:'wallet-signature-required',published_by:admin,updated_at:new Date().toISOString()};
  fs.writeFileSync('monitor/config.json',JSON.stringify(config,null,2)+'\n');fs.writeFileSync('monitor-config-success.txt',JSON.stringify({admin,alerts:alerts.length,copy_targets:copy_targets.length,updated_at:config.updated_at}));console.log('Monitor config verified',config);
}catch(e){fail(e?.stack||e)}
