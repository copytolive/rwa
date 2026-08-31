import fs from "node:fs";import path from "node:path";
const root=process.cwd();let checked=0;let files=0;const stack=[path.join(root,"src")];
while(stack.length){const p=stack.pop();const st=fs.statSync(p);if(st.isDirectory()){for(const x of fs.readdirSync(p))stack.push(path.join(p,x));continue}if(!p.endsWith(".tsx")||p.includes(`${path.sep}components${path.sep}ui${path.sep}`))continue;files++;const s=fs.readFileSync(p,"utf8");
for(const m of s.matchAll(/<button\b([^>]*)>/g)){checked++;if(!/onClick=|type="submit"|disabled/.test(m[1]))throw new Error(`Dead native button: ${path.relative(root,p)} :: ${m[0]}`)}
for(const m of s.matchAll(/<Button\b([^>]*)>/g)){checked++;if(!/onClick=|type="submit"|disabled=/.test(m[1]))throw new Error(`Dead Button: ${path.relative(root,p)} :: ${m[0]}`)}
for(const m of s.matchAll(/<Link\b([^>]*)>/g)){checked++;if(!/href=/.test(m[1]))throw new Error(`Link without href: ${path.relative(root,p)} :: ${m[0]}`)}
}
console.log(`Global interaction audit PASS: ${checked} controls across ${files} TSX files.`)
