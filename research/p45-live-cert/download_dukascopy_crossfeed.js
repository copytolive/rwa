#!/usr/bin/env node
'use strict';

// Independent cross-feed acquisition for frozen P45 certification.
// Source bytes are a public static GitHub mirror of Dukascopy XAUUSD M1 BID/ASK.
// Strategy parameters are not present here and are never tuned by this downloader.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const MIRROR_REPO = 'kevingtlin/Market-Data-Lab';
const MIRROR_COMMIT = '3fbaf3280338474b379e3a01ac3396f85d4a60be';
const RAW_BASE = `https://raw.githubusercontent.com/${MIRROR_REPO}/${MIRROR_COMMIT}/xauusd`;
const OUT = path.resolve('crossfeed_data');
fs.mkdirSync(OUT, { recursive: true });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'p45-crossfeed-cert/1.0' } }, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume(); return resolve(get(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => body += c.slice(0, 1000));
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode} ${url}: ${body}`)));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.setTimeout(120000, () => req.destroy(new Error(`timeout ${url}`)));
    req.on('error', reject);
  });
}

function months() {
  const out = [{ y: 2024, m: 12 }];
  for (let m = 1; m <= 12; m++) out.push({ y: 2025, m });
  return out;
}

async function acquire(side) {
  const parts = [];
  const manifest = [];
  for (const { y, m } of months()) {
    const mm = String(m).padStart(2, '0');
    const name = `xauusd_${side}_m1_${y}_${mm}.csv`;
    const url = `${RAW_BASE}/${side}/m1/${name}`;
    console.log(`download ${url}`);
    const b = await get(url);
    if (b.length < 1000) throw new Error(`unexpectedly small ${name}: ${b.length}`);
    const text = b.toString('utf8').replace(/^\uFEFF/, '').trimEnd();
    const lines = text.split(/\r?\n/);
    if (lines[0].trim().toLowerCase() !== 'timestamp,open,high,low,close') {
      throw new Error(`unexpected header ${name}: ${lines[0]}`);
    }
    if (parts.length === 0) parts.push(lines.join('\n'));
    else parts.push(lines.slice(1).join('\n'));
    manifest.push({ name, url, bytes: b.length, sha256: sha256(b), data_rows: lines.length - 1 });
  }
  const combined = Buffer.from(parts.join('\n') + '\n', 'utf8');
  const p = path.join(OUT, `dukascopy_${side}.csv`);
  fs.writeFileSync(p, combined);
  const meta = {
    provider: 'Dukascopy', mirror_repo: MIRROR_REPO, mirror_commit: MIRROR_COMMIT,
    side, combined_path: p, combined_bytes: combined.length, combined_sha256: sha256(combined),
    months: manifest,
  };
  fs.writeFileSync(path.join(OUT, `dukascopy_${side}_manifest.json`), JSON.stringify(meta, null, 2));
  console.log(JSON.stringify(meta));
}

(async () => {
  await acquire('bid');
  await acquire('ask');
})().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
