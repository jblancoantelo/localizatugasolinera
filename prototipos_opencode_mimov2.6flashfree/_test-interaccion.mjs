import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));

// C1: abrir detalle de una tarjeta + cambiar combustible + enviar IA
await page.goto('file:///' + path.join(root, 'c1-flow', 'index.html').replace(/\\/g, '/'));
await page.waitForTimeout(500);
await page.locator('.card-st').first().click();
await page.waitForTimeout(500);
const sheetOpen = await page.locator('#sheet.show, #sheet[data-snap="half"], #sheet[data-snap="full"]').count();
// el backdrop debe cubrir la pantalla al abrir el detalle (bloquea el resto)
await page.locator('.sheet-close').click();
await page.waitForTimeout(400);
await page.locator('.chip', { hasText: 'G98' }).click();
await page.waitForTimeout(400);
const cardsTrasG98 = await page.locator('#cards .card-st').count();
await page.locator('.bn-item[data-view="ia"]').click();
await page.locator('#iaInput').fill('¿Dónde repostar barato?');
await page.locator('#iaSend').click();
await page.waitForTimeout(1200);
const burbujasIA = await page.locator('#iaMsgs .ia-bub').count();
console.log('C1 → sheet abierto:', sheetOpen > 0, '| tarjetas tras G98:', cardsTrasG98, '| burbujas IA:', burbujasIA);

// C4: comparador
await page.goto('file:///' + path.join(root, 'c4-radar', 'index.html').replace(/\\/g, '/'));
await page.waitForTimeout(500);
const filasRank = await page.locator('.rank-row').count();
await page.locator('.rank-row').nth(1).click();
await page.waitForTimeout(400);
const sheetRadar = await page.locator('#rdSheet[data-open="si"]').count();
console.log('C4 → filas ranking:', filasRank, '| detalle abierto:', sheetRadar > 0);

// C6: swipe de página (clic en nav para cambiar de vista)
await page.goto('file:///' + path.join(root, 'c6-gesture', 'index.html').replace(/\\/g, '/'));
await page.waitForTimeout(500);
await page.locator('.gs-nav-btn', { hasText: 'Mapa' }).click().catch(() => {});
await page.waitForTimeout(600);
const mapaVisible = await page.locator('.gs-map-page, #gsMapPage').first().isVisible().catch(() => false);
console.log('C6 → mapa visible tras nav:', mapaVisible);

if (errs.length) { console.log('ERRORES JS:', errs); process.exit(1); }
console.log('Interacción OK: sin errores JS');
await browser.close();
