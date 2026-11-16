/* ============================================================================
   Matriz de cobertura funcional (estática) de los prototipos
   ----------------------------------------------------------------------------
   Lee cada .html y comprueba qué funciones de la app real están representadas
   (integración de ProtoFeat + primitivas propias). No sustituye a la
   auditoría interactiva (_auditar.cjs), pero detecta de un vistazo qué
   propuesta se ha quedado corta.

   Dos bloques:
   - APP: funciones visibles de la PWA real (filtros, datos, Config, IA).
   - EXTRA: patrones de diseño o mejoras que la app no tiene (comparador,
     tema, sheets, deep links, persistencia de prototipo, accesibilidad).

   Uso: node prototipos_opencode_deepseekv4.1flashfree/_cobertura.mjs
   ========================================================================== */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(DIR)
  .filter(f => /^v\d+-.+\.html$/.test(f))
  .sort((a, b) => +a.match(/^v(\d+)/)[1] - +b.match(/^v(\d+)/)[1]);

const CHECKS = [
  /* --- Funciones de la app real ---------------------------------------- */
  ['Filtros provincia/localidad', /fProv|fLoc|province|locality/, 'app'],
  ['Combustible', /fuel|FUELS|data-fuel/, 'app'],
  ['Marca', /fBrands|brandsOf|brandFilter|data-brand|state\.brands/, 'app'],
  ['Distancia máx.', /maxKm|fKm|kmLabel|data-km/, 'app'],
  ['Búsqueda', /search|buscar|#q\b|pickSearch/, 'app'],
  ['Favoritos', /fav|favorite|favorites/i, 'app'],
  ['Orden', /data-sort|sortKey|state\.sort|sortBtn|orderBy|sortOrder/, 'app'],
  ['Paginación', /ProtoFeat\.pager|pageSize|pager|Cargar más|moreBtn/, 'app'],
  ['Mapa sintético', /ProtoMap|mapHost|sideMap|data-map-host/, 'app'],
  ['Estilos de mapa', /ProtoFeat\.mapStyleSelect|mapStyle|TILE_CONFIGS|mapStyleSelect/, 'app'],
  ['Leyenda de precios', /ProtoFeat\.legend|legend\(|legMin|leveldot/, 'app'],
  ['Estado vacío', /ProtoFeat\.empty|empty\(|emptyReset|Sin resultados/, 'app'],
  ['Detalle de estación', /stationDetail|detailPanel|detailSheet|openDetail/, 'app'],
  ['Histórico + gráfica', /histChart|drawPriceChart|ProtoChart|histOvChart|cmpChart/, 'app'],
  ['Config: descuentos', /Descuentos por marca/, 'app'],
  ['Config: caché', /Caché de datos|cache-list/, 'app'],
  ['Config: paginación', /Paginación/, 'app'],
  ['Config: logs API/Push', /Registro de actividad/, 'app'],
  ['Config: push', /Notificaciones push/, 'app'],
  ['Config: claves IA', /Claves API de IA/, 'app'],
  ['Config: pestañas IA', /Pestañas de IA/, 'app'],
  ['Config: actualización', /Actualización de la app/, 'app'],
  ['Config completa', /ProtoFeat\.configPanel/, 'app'],
  ['IA: panel completo', /ProtoFeat\.iaPanel|PROVS|AI_PROVIDERS|ia-provider/, 'app'],
  ['IA: proveedores', /groq|mistral|openrouter|llm7|nvidia|gemini/i, 'app'],

  /* --- Patrones/mejoras que la app real no tiene ----------------------- */
  ['Comparador', /data-compare|toggleCompare|cmpBtn|state\.compare|comparePrices|toggleSel\b/, 'extra'],
  ['Tema claro/oscuro', /data-theme-toggle|Proto\.theme/, 'extra'],
  ['Persistencia (localStorage)', /localStorage/, 'extra'],
  ['Deep links / pantalla', /Proto\.param\('screen'\)|\?screen=|history\.replaceState/, 'extra'],
  ['Toasts', /Proto\.toast/, 'extra'],
  ['Sheets arrastrables', /Proto\.sheet/, 'extra'],
  ['Accesible (aria-label)', /aria-label/, 'extra'],
];

const APP = CHECKS.filter(c => c[2] === 'app').map(c => c[0]);
const EXTRA = CHECKS.filter(c => c[2] === 'extra').map(c => c[0]);

/* Un componente de paridad implica todas sus subfunciones: si el HTML monta
   ProtoFeat.configPanel, las 8 tarjetas existen aunque sus rótulos vivan en
   proto-features.js (que este escáner no lee). */
const CONFIG_SUBS = APP.filter(n => n.startsWith('Config: '));
const EXPLORER_IMPLIES = [
  'Filtros provincia/localidad', 'Combustible', 'Marca', 'Distancia máx.',
  'Búsqueda', 'Favoritos', 'Orden', 'Paginación', 'Mapa sintético',
  'Estilos de mapa', 'Leyenda de precios', 'Estado vacío',
  'Detalle de estación', 'Histórico + gráfica',
];

const rows = files.map(f => {
  const html = fs.readFileSync(path.join(DIR, f), 'utf8');
  const hit = {};
  for (const [name, re] of CHECKS) hit[name] = re.test(html);
  if (/ProtoFeat\.configPanel/.test(html)) CONFIG_SUBS.forEach(n => { hit[n] = true; });
  if (/ProtoFeat\.iaPanel|PROVS|AI_PROVIDERS/.test(html)) hit['IA: proveedores'] = true;
  if (/ProtoFeat\.explorer/.test(html)) EXPLORER_IMPLIES.forEach(n => { hit[n] = true; });
  const app = APP.filter(n => hit[n]).length;
  const extra = EXTRA.filter(n => hit[n]).length;
  return { f, hit, app, extra };
});

const pad = (s, n) => String(s).padEnd(n);
const w = 26;
const line = '─'.repeat(w + files.length * 9);

function tabla(titulo, names, key) {
  console.log('\n' + titulo);
  console.log(pad('Funcionalidad', w) + files.map(f => pad(f.replace(/\.html$/, ''), 9)).join(''));
  console.log(line);
  for (const name of names) {
    console.log(pad(name, w) + rows.map(r => pad(r.hit[name] ? '  ✓' : '  ·', 9)).join(''));
  }
  console.log(line);
  console.log(pad('TOTAL', w) + rows.map(r => pad(' ' + r[key] + '/' + names.length, 9)).join(''));
}

tabla('FUNCIONES DE LA APP REAL', APP, 'app');
tabla('PATRONES EXTRA DE LOS PROTOTIPOS', EXTRA, 'extra');

const missing = rows.map(r => ({
  f: r.f,
  app: `${r.app}/${APP.length}`,
  extra: `${r.extra}/${EXTRA.length}`,
  faltanApp: APP.filter(n => !r.hit[n]),
  faltanExtra: EXTRA.filter(n => !r.hit[n]),
}));
const out = path.join(DIR, 'capturas', 'cobertura.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(missing, null, 2));
console.log('\nDetalle en ' + path.relative(process.cwd(), out));
