import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {verifyMessage} from 'viem';
import {sha256} from './db.mjs';

const normWallet=w=>{const x=String(w||'').toLowerCase();if(!/^0x[a-f0-9]{40}$/.test(x))throw Error('invalid_wallet');return x};
const b64url=b=>Buffer.from(b).toString('base64url');
const safeEq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};

export class AuthService{
  constructor(db,{origin=process.env.RWA_COMMERCE_PUBLIC_ORIGIN||'https://narzulalistiqlal.github.io',sessionTtlMs=Number(process.env.RWA_COMMERCE_SESSION_TTL_MS||86400000),challengeTtlMs=Number(process.env.RWA_COMMERCE_CHALLENGE_TTL_MS||300000)}={}){this.db=db;this.origin=origin;this.sessionTtlMs=sessionTtlMs;this.challengeTtlMs=challengeTtlMs}
  challenge(wallet){wallet=normWallet(wallet);const nonce=b64url(randomBytes(24)),issuedAt=new Date().toISOString(),expiresAt=Date.now()+this.challengeTtlMs,message=`RWA COMMERCE LOGIN V1\nWallet: ${wallet}\nOrigin: ${this.origin}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;this.db.challengePut({wallet,nonce,message,expiresAt});return{wallet,message,expires_at:expiresAt}}
  async verify({wallet,signature}){wallet=normWallet(wallet);const row=this.db.challengeGet(wallet);if(!row||Number(row.expires_at)<=Date.now())throw Error('challenge_expired');const ok=await verifyMessage({address:wallet,message:row.message,signature:String(signature||'')});if(!ok)throw Error('invalid_signature');this.db.challengeDelete(wallet);const token=b64url(randomBytes(32)),expiresAt=Date.now()+this.sessionTtlMs;this.db.sessionPut({tokenHash:sha256(token),wallet,expiresAt});this.db.audit(wallet,'auth.login','wallet',wallet,{});return{token,wallet,expires_at:expiresAt}}
  session(req){const h=String(req.headers.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!token)return null;const row=this.db.sessionGet(sha256(token));return row?{wallet:row.wallet,tokenHash:row.token_hash,expiresAt:row.expires_at}:null}
  requireSession(req){const s=this.session(req);if(!s)throw Object.assign(Error('unauthorized'),{statusCode:401});return s}
  logout(req){const s=this.requireSession(req);this.db.sessionRevoke(s.tokenHash);this.db.audit(s.wallet,'auth.logout','wallet',s.wallet,{});return{ok:true}}
  requireAdmin(req){const expected=String(process.env.RWA_COMMERCE_ADMIN_TOKEN_SHA256||'').trim().toLowerCase();if(!/^[a-f0-9]{64}$/.test(expected))throw Object.assign(Error('admin_not_configured'),{statusCode:503});const h=String(req.headers.authorization||''),token=h.startsWith('Bearer ')?h.slice(7).trim():'';const actual=createHash('sha256').update(token).digest('hex');if(!token||!safeEq(actual,expected))throw Object.assign(Error('unauthorized'),{statusCode:401});return{actor:'admin'}}
}

export {normWallet};
