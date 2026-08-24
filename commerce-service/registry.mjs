import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,'..');
const isHttps=v=>/^https:\/\//i.test(String(v||''));
const normToken=v=>String(v||'').trim().toUpperCase();
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

function readJson(path){return JSON.parse(readFileSync(path,'utf8'))}
function verifiedAssets(doc){
  const rows=Array.isArray(doc?.verified)?doc.verified:[];
  return new Set(rows.filter(x=>String(x?.status||'VERIFIED').toUpperCase()==='VERIFIED').map(x=>normToken(x.token||x.symbol||x.id)).filter(Boolean));
}
function validateStore(raw,assets){
  const p=raw?.physical_store||{},token=normToken(raw?.token);
  if(!/^[A-Z0-9][A-Z0-9-]{1,31}$/.test(token))throw Error(`registry_invalid_token:${token||'empty'}`);
  if(String(raw?.status||'').toUpperCase()!=='VERIFIED')throw Error(`registry_store_not_verified:${token}`);
  const required={name:p.store_name||raw.name,fullAddress:p.full_address,photo:p.storefront_photo_url,business:p.business_registration_url,merchant:p.merchant_identity_url};
  for(const [k,v] of Object.entries(required))if(!String(v||'').trim())throw Error(`registry_missing_${k}:${token}`);
  for(const [k,v] of [['photo',required.photo],['business',required.business],['merchant',required.merchant]])if(!isHttps(v))throw Error(`registry_${k}_https_required:${token}`);
  if(p.catalog_url&&!isHttps(p.catalog_url))throw Error(`registry_catalog_https_required:${token}`);
  const lat=Number(p.geo?.lat),lng=Number(p.geo?.lng);
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lng)||lng<-180||lng>180)throw Error(`registry_invalid_geo:${token}`);
  if(!assets.has(token))throw Error(`registry_asset_not_verified:${token}`);
  return{token,name:String(required.name).trim(),category:String(raw.category||'Physical commerce').trim(),fullAddress:String(required.fullAddress).trim(),lat,lng,contact:String(p.contact||raw.contact||''),openingHours:String(p.opening_hours||raw.opening_hours||''),photo:String(required.photo),business:String(required.business),merchant:String(required.merchant),catalog:String(p.catalog_url||raw.catalog_url||''),assetVerified:true,storeVerified:true,tradeEnabled:raw.trade_enabled===true,status:'VERIFIED',registryHash:hash(raw)};
}

export class RegistryService{
  constructor(db,{registryPath=process.env.RWA_COMMERCE_REGISTRY_PATH||resolve(ROOT,'rwa-commerce-registry.json'),assetsPath=process.env.RWA_COMMERCE_ASSETS_PATH||resolve(ROOT,'rwa-assets.json')}={}){this.db=db;this.registryPath=registryPath;this.assetsPath=assetsPath}
  read(){const registry=readJson(this.registryPath),assets=readJson(this.assetsPath);if(registry?.policy!=='ONE_TOKEN_ONE_PHYSICAL_STORE_V1')throw Error('registry_policy_mismatch');return{registry,assets}}
  sync({actor='system'}={}){
    const {registry,assets}=this.read(),assetSet=verifiedAssets(assets),rows=Array.isArray(registry.stores)?registry.stores:[],seenToken=new Set(),seenAddress=new Set(),accepted=[];
    for(const raw of rows){const s=validateStore(raw,assetSet),address=s.fullAddress.toLowerCase();if(seenToken.has(s.token))throw Error(`registry_duplicate_token:${s.token}`);if(seenAddress.has(address))throw Error(`registry_duplicate_physical_store:${s.token}`);seenToken.add(s.token);seenAddress.add(address);accepted.push(s)}
    this.db.transaction(()=>{for(const s of accepted)this.db.upsertStore(s)});
    this.db.audit(actor,'registry.sync','registry','rwa-commerce-registry',{accepted:accepted.length,policy:registry.policy});
    return{ok:true,policy:registry.policy,stores:accepted.length,tokens:accepted.map(x=>x.token)};
  }
  snapshot(){return{stores:this.db.stores().map(s=>({token:s.token,name:s.name,category:s.category,full_address:s.full_address,geo:{lat:s.lat,lng:s.lng},contact:s.contact,opening_hours:s.opening_hours,storefront_photo_url:s.storefront_photo_url,business_registration_url:s.business_registration_url,merchant_identity_url:s.merchant_identity_url,catalog_url:s.catalog_url,asset_verified:!!s.asset_verified,store_verified:!!s.store_verified,trade_enabled:!!s.trade_enabled,status:s.status,updated_at:s.updated_at})),products:this.db.products().map(p=>({id:p.id,store_token:p.store_token,sku:p.sku,name:p.name,description:p.description,price_cents:p.price_cents,currency:p.currency,available:p.available,pickup:!!p.pickup,shipping:!!p.shipping,image_url:p.image_url}))}}
}

export {validateStore,verifiedAssets};
