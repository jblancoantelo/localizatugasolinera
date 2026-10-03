// Genera la lista ASSETS del Service Worker a partir de los ficheros que el
// index.html carga realmente, para que no se desincronice al añadir un script
// o un icono nuevo (paso en el que se colaron los ficheros ausentes).
//
// Uso:  node scripts/sync-sw-assets.mjs [--check]
//   --check  solo verifica, no escribe (devuelve 1 si hay diferencias)
import { readFileSync, writeFileSync } from 'fs';

const START = '// assets:start';
const END = '// assets:end';
const IGNORED = new Set(['/', '#']);
const EXTRA = ['index.html', 'offline.html', 'manifest.json'];

function collectAssets(html) {
  const found = new Set(EXTRA);
  const re = /(?:src|href)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const ref = m[1].trim();
    if (!ref || IGNORED.has(ref)) continue;
    if (/^(https?:)?\/\//i.test(ref) || /^(data|mailto|tel|blob|javascript):/i.test(ref)) continue;
    // Solo ficheros reales del repo: css, js, manifest, offline e iconos.
    if (!/^(css|js|icons)\//.test(ref) && !/^(index|offline)\.html$/.test(ref) && !/^manifest\.json$/.test(ref)) continue;
    found.add(ref.split('?')[0].split('#')[0]);
  }
  // Orden estable y predecible: primero index/offline, luego css, luego js.
  const rank = p => (/^index\.html$/.test(p) ? 0 : /^offline\.html$/.test(p) ? 1 : /^manifest\.json$/.test(p) ? 2
    : /^css\//.test(p) ? 3 : /^js\//.test(p) ? 4 : 5);
  return [...found].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function renderBlock(assets) {
  const body = assets.map(a => "  BASE + '" + a + "'").join(',\n');
  return START + ' (generado por scripts/sync-sw-assets.mjs — no editar a mano)\n'
    + 'const ASSETS = [\n' + body + '\n];\n' + END;
}

export function syncAssets({ check = false } = {}) {
  const html = readFileSync('index.html', 'utf8');
  const sw = readFileSync('sw.js', 'utf8');
  const start = sw.indexOf(START);
  const end = sw.indexOf(END);
  if (start < 0 || end < 0) {
    console.error('ERROR: no se encuentra el bloque ' + START + ' … ' + END + ' en sw.js');
    process.exit(1);
  }
  const before = sw.slice(start, end + END.length);
  const after = renderBlock(collectAssets(html));
  if (before === after) return { changed: false, count: collectAssets(html).length };

  if (check) {
    console.error('ERROR: la lista ASSETS de sw.js no coincide con index.html. Ejecuta: node scripts/sync-sw-assets.mjs');
    process.exit(1);
  }
  writeFileSync('sw.js', sw.slice(0, start) + after + sw.slice(end + END.length));

  // Todo lo que el SW importa con importScripts tiene que estar precacheado,
  // o el SW arranca sin esas funciones (es lo que pasaba con js/ai-chat.js).
  const imports = [...sw.matchAll(/importScripts\(([^)]*)\)/g)]
    .flatMap(x => (x[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)));
  const assets = collectAssets(html);
  const missing = imports.filter(f => !assets.includes(f));
  if (missing.length) {
    console.error('ERROR: importScripts referencia ficheros que no están en ASSETS: ' + missing.join(', '));
    process.exit(1);
  }
  return { changed: true, count: assets.length, added: assets.filter(a => !before.includes(a)) };
}

if (process.argv[1] && process.argv[1].endsWith('sync-sw-assets.mjs')) {
  const r = syncAssets({ check: process.argv.includes('--check') });
  console.log(r.changed
    ? 'ASSETS de sw.js sincronizados con index.html (' + r.count + ' ficheros' + (r.added && r.added.length ? ', nuevos: ' + r.added.join(', ') : '') + ')'
    : 'ASSETS de sw.js ya sincronizados (' + r.count + ' ficheros)');
}