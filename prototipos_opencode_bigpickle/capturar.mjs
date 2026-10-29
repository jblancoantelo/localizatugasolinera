/* =============================================================================
 * Capturas automáticas + smoke test de los prototipos
 * -----------------------------------------------------------------------------
 * Abre cada prototipo por file:// en dos tamaños (móvil 390×844 y PC 1440×900),
 * guarda las capturas en shared/capturas/ y falla si hay errores de consola.
 *
 *   node prototipos_opencode_bigpickle/capturar.mjs            → todos los prototipos
 *   node prototipos_opencode_bigpickle/capturar.mjs 1 3        → solo los prototipos 1 y 3
 *
 * Convención (definida en el encargo de diseño):
 *   [data-shot="detalle"] → primer elemento que abre el detalle de estación
 *   [data-shot="vista"]   → elemento que cambia de vista principal
 * ========================================================================== */
import { chromium } from 'playwright';
import { readdir, mkdir, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirCapturas = path.join(aqui, 'shared', 'capturas');
const filtros = process.argv.slice(2);

async function carpetas() {
  const entradas = await readdir(aqui, { withFileTypes: true });
  const lista = [];
  for (const e of entradas) {
    if (!e.isDirectory() || !/^prototipo/i.test(e.name)) continue;
    const html = path.join(aqui, e.name, 'index.html');
    try { await access(html); lista.push({ nombre: e.name, html }); } catch { /* sin index.html */ }
  }
  return lista
    .filter((p) => !filtros.length || filtros.some((f) => p.nombre.startsWith('prototipo' + f)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function recolectarErrores(page, bolsa, etiqueta) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bolsa.push(`[${etiqueta}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => bolsa.push(`[${etiqueta}] pageerror: ${err.message}`));
}

async function capturar(page, proto, sufijo) {
  const destino = path.join(dirCapturas, `${proto.nombre}${sufijo}.png`);
  await page.screenshot({ path: destino, fullPage: false });
  console.log('   · ' + path.relative(process.cwd(), destino));
}

const lista = await carpetas();
if (!lista.length) { console.error('No hay prototipos que capturar.'); process.exit(1); }
await mkdir(dirCapturas, { recursive: true });

const errores = [];
const navegador = await chromium.launch();

for (const proto of lista) {
  console.log('\n' + proto.nombre);
  const url = pathToFileURL(proto.html).href;

  /* --- Móvil primero --- */
  const ctxMovil = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const movil = await ctxMovil.newPage();
  recolectarErrores(movil, errores, proto.nombre + ' móvil');
  await movil.goto(url);
  await movil.waitForTimeout(700);
  await capturar(movil, proto, '-movil');

  const detalle = movil.locator('[data-shot="detalle"]').first();
  if (await detalle.count()) {
    try {
      await detalle.click({ timeout: 2500 });
      await movil.waitForTimeout(700);
      await capturar(movil, proto, '-movil-detalle');
    } catch (err) {
      errores.push(`[${proto.nombre} móvil] no se pudo abrir el detalle: ${err.message.split('\n')[0]}`);
    }
  }
  const vista = movil.locator('[data-shot="vista"]').first();
  if (await vista.count()) {
    try {
      /* Recargamos: el detalle deja un velo abierto que bloquearía el clic */
      await movil.reload();
      await movil.waitForTimeout(600);
      await vista.click({ timeout: 2500 });
      await movil.waitForTimeout(600);
      await capturar(movil, proto, '-movil-vista');
    } catch (err) {
      errores.push(`[${proto.nombre} móvil] no se pudo cambiar de vista: ${err.message.split('\n')[0]}`);
    }
  }
  await ctxMovil.close();

  /* --- Escritorio --- */
  const ctxPc = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pc = await ctxPc.newPage();
  recolectarErrores(pc, errores, proto.nombre + ' PC');
  await pc.goto(url);
  await pc.waitForTimeout(700);
  await capturar(pc, proto, '-pc');
  await ctxPc.close();
}

await navegador.close();

console.log('\n' + '='.repeat(60));
if (errores.length) {
  console.log(`${errores.length} problema(s) detectado(s):`);
  errores.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log(`✅ ${lista.length} prototipo(s) sin errores de consola. Capturas en shared/capturas/`);
