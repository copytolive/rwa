#!/usr/bin/env node
import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();
const src=process.argv[2]||'tmp/sec/company_tickers_exchange.json';
if(!fs.existsSync(src))throw new Error(`missing ${src}`);
const raw=JSON.parse(fs.readFileSync(src,'utf8'));
const fields=raw.fields||['cik','name','ticker','exchange'];
const ex={Nasdaq:['XNAS','NASDAQ','NASDAQ'],NYSE:['XNYS','NYSE','NYSE'],'NYSE Arca':['ARCX','NYSE Arca','AMEX'],'NYSE American':['XASE','NYSE American','AMEX'],'Cboe BZX':['BATS','Cboe BZX','BATS']};
const securities=[];
for(const row of raw.data||[]){const r=Object.fromEntries(fields.map((f,i)=>[f,row[i]]));const m=ex[String(r.exchange||'')];if(!m||!r.ticker||!r.name||!r.cik)continue;const ticker=String(r.ticker).trim();securities.push({id:`US-${m[0]}-${ticker.replace(/[^A-Za-z0-9.-]/g,'_')}`,asset_class:'stock',security_type:'SEC_REPORTING_ISSUER',ticker,name:String(r.name).trim(),mic:m[0],exchange:m[1],country:'US',currency:'USD',cik:String(r.cik).replace(/\D/g,'').padStart(10,'0'),tv_symbol:`${m[2]}:${ticker}`,market_data_status:'SOURCE GATED',fundamental_source:'SEC',identity_source_url:'https://www.sec.gov/files/company_tickers_exchange.json'})}
const file=path.join(root,'data/global/security-master.json');const master=JSON.parse(fs.readFileSync(file,'utf8'));master.generated_at=new Date().toISOString();master.status='OFFICIAL_US_SYNC_PLUS_GLOBAL_SEEDS';master.securities=[...securities,...master.securities.filter(x=>x.country!=='US')].sort((a,b)=>a.country.localeCompare(b.country)||a.ticker.localeCompare(b.ticker));fs.writeFileSync(file,JSON.stringify(master,null,2)+'\n');console.log(`SEC US CATALOG PASS · ${securities.length} issuer/ticker associations`);
