import fs from "node:fs";
import path from "node:path";

const root = path.resolve("out");
const textExt = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".txt", ".xml"]);
let files = 0;
let replacements = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (textExt.has(path.extname(entry.name))) {
      const before = fs.readFileSync(p, "utf8");
      const after = before
        .replaceAll('"/realworldasset/', '"/rwa/')
        .replaceAll("'/realworldasset/", "'/rwa/")
        .replaceAll("url(/realworldasset/", "url(/rwa/")
        .replaceAll("url('/realworldasset/", "url('/rwa/")
        .replaceAll('url("/realworldasset/', 'url("/rwa/');
      if (after !== before) {
        replacements += (before.match(/\/realworldasset\//g) || []).length;
        fs.writeFileSync(p, after);
        files += 1;
      }
    }
  }
}

if (!fs.existsSync(root)) throw new Error(`Missing export directory: ${root}`);
walk(root);

let stale = [];
function verify(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) verify(p);
    else if (textExt.has(path.extname(entry.name))) {
      const text = fs.readFileSync(p, "utf8");
      if (/(["'(])\/realworldasset\//.test(text)) stale.push(path.relative(root, p));
    }
  }
}
verify(root);
if (stale.length) throw new Error(`Stale public /realworldasset/ roots remain: ${stale.join(", ")}`);
console.log(`RWA_PUBLIC_ROOT_NORMALIZED files=${files} replacements=${replacements}`);
