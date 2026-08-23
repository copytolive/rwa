const DB_NAME = 'rwa-trade-safe-v1';
const STORE = 'kv';
const AES_ID = 'agent-aes-key-v1';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tr = db.transaction(STORE, mode);
      const store = tr.objectStore(STORE);
      let result;
      try { result = fn(store); } catch (error) { reject(error); return; }
      if (result && typeof result.onsuccess === 'object') {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error || new Error('IndexedDB request failed'));
      } else {
        tr.oncomplete = () => resolve(result);
      }
      tr.onerror = () => reject(tr.error || new Error('IndexedDB transaction failed'));
      tr.onabort = () => reject(tr.error || new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function getValue(key) { return tx('readonly', store => store.get(key)); }
async function putValue(key, value) { return tx('readwrite', store => store.put(value, key)); }
async function deleteValue(key) { return tx('readwrite', store => store.delete(key)); }

async function aesKey() {
  let key = await getValue(AES_ID);
  if (key) return key;
  key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await putValue(AES_ID, key);
  return key;
}

function bytesToB64(bytes) {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return btoa(out);
}
function b64ToBytes(text) {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function agentKey(master, testnet) {
  return `agent:${String(master).toLowerCase()}:${testnet ? 'testnet' : 'mainnet'}`;
}

export async function saveAgent({ master, testnet, privateKey, address, agentName, expiresAt, pending = false }) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(privateKey))) throw new Error('Invalid agent private key');
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(privateKey);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const row = {
    v: 1,
    master: String(master).toLowerCase(),
    testnet: !!testnet,
    address: String(address).toLowerCase(),
    agentName: String(agentName),
    expiresAt: Number(expiresAt || 0),
    createdAt: Date.now(),
    pending: !!pending,
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ciphertext)),
    storage: 'AES-GCM-256 / non-extractable WebCrypto key / IndexedDB'
  };
  await putValue(agentKey(master, testnet), row);
  return row;
}

export async function getAgentRecord(master, testnet) {
  return (await getValue(agentKey(master, testnet))) || null;
}

export async function loadAgentPrivateKey(master, testnet) {
  const row = await getAgentRecord(master, testnet);
  if (!row) return null;
  if (row.expiresAt && Date.now() >= row.expiresAt) return null;
  const key = await aesKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(row.iv) },
    key,
    b64ToBytes(row.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

export async function markAgentReady(master, testnet) {
  const row = await getAgentRecord(master, testnet);
  if (!row) throw new Error('Agent record missing');
  row.pending = false;
  row.verifiedAt = Date.now();
  await putValue(agentKey(master, testnet), row);
  return row;
}

export async function deleteAgent(master, testnet) {
  await deleteValue(agentKey(master, testnet));
}
