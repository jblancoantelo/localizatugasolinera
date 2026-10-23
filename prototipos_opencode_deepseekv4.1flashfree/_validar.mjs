/* ============================================================================
   Validador de los prototipos
   ----------------------------------------------------------------------------
   Abre cada prototipo en Chromium real (Playwright, ya instalado en el repo),
   recoge errores de consola y excepciones, recorre la navegación principal y
    guarda capturas en prototipos_opencode_deepseekv4.1flashfree/capturas/.

    Uso:
      node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs        # todos los .html
      node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs v1 v2  # solo los que contengan esos textos
      node prototipos_opencode_deepseekv4.1flashfree/_validar.mjs --movil  # solo viewport móvil
   ========================================================================== */
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(DIR, 'capturas');
const args = process.argv.slice(2);
const filters = args.filter(a => !a.startsWith('--'));
const movilOnly = args.includes('--movil');
const deskOnly = args.includes('--escritorio');

const VIEWPORTS = [
  { id: 'movil', label: '390×844', width: 390, height: 844, dsf: 2 },
  { id: 'escritorio', label: '1440×900', width: 1440, height: 900, dsf: 1 },
];
const VPS = movilOnly ? VIEWPORTS.slice(0, 1) : deskOnly ? VIEWPORTS.slice(1) : VIEWPORTS;

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html')
  .filter(f => !filters.length || filters.some(x => f.includes(x)))
  .sort();

/* Se prueban varias vías de arranque: el navegador de Playwright puede no estar
   descargado en esta máquina, pero Chrome del sistema sí suele estarlo. */
async function launch() {  const tries = [{}, { channel: 'chromium' }, { channel: 'chrome' }, { channel: 'msedge' }];
  for (const opt of tries) {
    try { const b = await chromium.launch({ headless: true, ...opt }); console.log('Navegador: ' + (opt.channel || 'chromium de Playwright')); return b; }
    catch (e) { /* siguiente vía */ }
  }
  throw new Error('No hay navegador disponible: ejecuta "npx playwright install chromium"');
}

/* Antes de abrir el navegador: sintaxis de los <script> inline. Un paréntesis de
   más deja la página en blanco y en consola solo se ve "Unexpected token". */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-syntax-'));
function checkInline(file) {
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const errs = [];
  blocks.forEach((code, i) => {
    if (!code.trim()) return;
    const tmp = path.join(TMP, file.replace(/\.html$/, '') + '-' + i + '.js');
    fs.writeFileSync(tmp, code);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
    catch (e) {
      const out = String(e.stderr || e.stdout || e.message).split('\n').filter(Boolean).slice(0, 4).join(' · ');
      errs.push('sintaxis (script #' + (i + 1) + '): ' + out);
    }
  });
  return errs;
}

const browser = await launch();
let failures = 0;
const report = [];

for (const file of files) {
  const syntaxErrors = checkInline(file);
  for (const vp of VPS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      isMobile: vp.id === 'movil',
      hasTouch: vp.id === 'movil',
      colorScheme: 'light',
    });
    const page = await ctx.newPage();
    const errors = [...syntaxErrors];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + (process.env.PROTO_TRACE ? e.stack : e.message)));

    const url = pathToFileURL(path.join(DIR, file)).href + '?embed=1';
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(700);

    const base = file.replace('.html', '') + '-' + vp.id;
    await page.screenshot({ path: path.join(SHOTS, base + '-1.png') });

    // Recorrido de navegación: pulsa cada botón de tab/bottom nav y captura
    const tabs = await page.$$('nav .nav-btn, [data-nav] [data-tab]');
    let i = 1;
    for (const t of tabs.slice(0, 6)) {
      try {
        await t.click({ timeout: 1500 });
        await page.waitForTimeout(420);
        i++;
        await page.screenshot({ path: path.join(SHOTS, base + '-' + i + '.png') });
      } catch (e) { /* botón no visible en este viewport: no es un fallo */ }
    }

    // Abre la primera tarjeta de estación si existe
    const card = await page.$('.station, .pm-marker');
    if (card) {
      try {
        await card.click({ timeout: 1500 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(SHOTS, base + '-detalle.png') });
      } catch (e) { /* opcional */ }
    }

    const scroll = await page.evaluate(() => ({
      bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
      h: document.body.scrollHeight,
    }));

    report.push({ file, vp: vp.id, errors, scrollX: scroll.bodyOverflow });
    if (errors.length) failures += errors.length;
    console.log(`${errors.length ? '✗' : '✓'} ${file} [${vp.id}]` + (errors.length ? '\n    ' + errors.join('\n    ') : ''));
    await ctx.close();
  }
}

await browser.close();
console.log('\n' + (failures ? `${failures} error(es) detectados` : 'Sin errores de consola ni excepciones'));
console.log('Capturas en ' + path.relative(process.cwd(), SHOTS));
fs.writeFileSync(path.join(SHOTS, 'informe.json'), JSON.stringify(report, null, 2));
process.exit(failures ? 1 : 0);
