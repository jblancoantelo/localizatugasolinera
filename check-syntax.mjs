// Comprobación de sintaxis de todo el JS del proyecto sin dependencias externas.
// Los ficheros "clásicos" se compilan con el compilador de Node; los que usan
// sintaxis de módulo (import/export, p. ej. el Worker de Cloudflare) se
// validan con "node --check" sobre una copia .mjs temporal, porque en un
// Service Worker el import se hace con importScripts y en un Worker con ESM.
//
// También comprueba los <script> en línea del index.html, que es donde se
// registra el SW y se inyecta el manifest y donde ningún test llega.
//
// Uso:  node check-syntax.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { execFileSync } from 'child_process';

const files = [
  ...fs.readdirSync('js').filter(f => f.endsWith('.js')).sort().map(f => 'js/' + f),
  'sw.js',
  'workers/nvidia-proxy.js',
  'scripts/bump-version.mjs',
  'scripts/sync-sw-assets.mjs'
];

const html = fs.readFileSync('index.html', 'utf8');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (inline.length) files.push({ name: 'index.html (inline script)', code: inline.join('\n') });

const isModule = code => /^\s*(export\s|import\s+[^(])/m.test(code);

function checkWithNode(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petrol-syntax-'));
  const file = path.join(dir, 'check.mjs');
  try {
    fs.writeFileSync(file, code);
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

let errors = 0;
for (const entry of files) {
  const name = typeof entry === 'string' ? entry : entry.name;
  try {
    const code = typeof entry === 'string' ? fs.readFileSync(entry, 'utf-8') : entry.code;
    if (isModule(code)) checkWithNode(code);
    else new vm.Script(code, { filename: name });
    console.log('✓ ' + name);
  } catch (e) {
    errors++;
    console.log('✗ ' + name + ' - ERROR: ' + String(e.stderr || e.message).split('\n').slice(0, 3).join(' '));
  }
}
console.log(files.length - errors + '/' + files.length + ' ficheros OK');
process.exit(errors ? 1 : 0);