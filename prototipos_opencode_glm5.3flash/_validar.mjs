// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Juan Blanco Antelo - Localiza tu Gasolinera (prototipos de diseno)

/* =============================================================================
 * Validador de prototipos_opencode_glm5.3flash
 * =============================================================================
 * Abre cada prototipo con Chromium headless (Playwright) en dos ventanas:
 *   móvil  : 390x844 (tipo iPhone 14/Pixel)
 *   PC     : 1440x900
 * y comprueba que:
 *   1. no saltan errores de JavaScript (pageerror / console.error)
 *   2. window.PT_VALID == 'vXX' (los scripts llegaron al final)
 *   3. hay interacción mínima: un clic en navegación y cambio de combustible
 * Guarda capturas en _capturas/<nnn>-<id>-<mv|pc>.png
 *
 * Uso:  node prototipos_opencode_glm5.3flash/_validar.mjs   (desde la raíz del repo)
 * ========================================================================== */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const capturas = path.join(aqui, '_capturas');
if (!fs.existsSync(capturas)) fs.mkdirSync(capturas, { recursive: true });

const PROTOS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['index', 'v01-tarjetas-chips', 'v02-mapa-hoja', 'v03-material',
     'v04-escritorio-denso', 'v05-noche-conduccion', 'v06-contraste',
     'v07-torre-control', 'v08-flujo'];

const VENTANAS = [
  { suf: 'mv', w: 390, h: 844, dpr: 0.9 },
  { suf: 'pc', w: 1440, h: 900, dpr: 0.6 }
];

let fallos = 0;
const browser = await chromium.launch();

for (const p of PROTOS) {
  const esGaleria = p === 'index';
  const url = pathToFileURL(esGaleria
    ? path.join(aqui, 'index.html')
    : path.join(aqui, p, 'index.html')).href;

  for (const v of VENTANAS) {
    const ctx = await browser.newContext({
      viewport: { width: v.w, height: v.h },
      deviceScaleFactor: v.dpr
    });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 15000 });
      await page.waitForTimeout(700);

      const valido = await page.evaluate(() => window.PT_VALID || null);
      if (!esGaleria && !valido) errores.push('sin window.PT_VALID (¿abortó el script?)');

      // interacción mínima: si hay barra de pestañas, saltar a la 2ª vista
      const navBtns = page.locator('.tabs button, .navb button, .mtabs button, .tabsS button').last();
      if (await navBtns.count()) {
        await navBtns.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }

      await page.screenshot({
        path: path.join(capturas, `${esGaleria ? 'fondo' : p.replace(/^v(\d+)-.*$/, 'v$1')}-${v.suf}.png`),
        fullPage: false
      });

      if (errores.length) {
        fallos++;
        console.log(`✗ ${p} [${v.suf}]`);
        errores.slice(0, 6).forEach(e => console.log('    ' + e));
      } else {
        console.log(`✓ ${p} [${v.suf}]`);
      }
    } catch (e) {
      fallos++;
      console.log(`✗ ${p} [${v.suf}] — ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
  }
}

await browser.close();
if (fallos) {
  console.log(`\n${fallos} validaciones con problemas`);
  process.exit(1);
}
console.log('\nTodo limpio ✔');
