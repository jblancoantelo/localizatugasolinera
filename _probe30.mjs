import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
const abrir = async (dir, w = 1440, h = 900) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(800);
  return { ctx, p, errs };
};

/* P1: descuento de Repsol sobre la ficha/lista de la estación 1001 */
{
  const { ctx, p, errs } = await abrir('prototipo1-mapa-hojas', 1440, 900);
  const precio1001 = () => p.evaluate(() => {
    const el = document.querySelector('[data-estacion="1001"], [data-marcador="1001"]');
    return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : null;
  });
  console.log('P1 1001 antes:', await precio1001());
  await p.locator('button[data-vista="config"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const inp = p.locator('[data-desc-valor="Repsol"]').first();
  await inp.fill('0.20');
  await inp.dispatchEvent('change');
  await p.waitForTimeout(600);
  await p.locator('button[data-vista="lista"]').first().click({ force: true });
  await p.waitForTimeout(600);
  console.log('P1 1001 con 0,20:', await precio1001());
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P8: favorito desde la ficha */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('#tablaEst tbody tr')?.click());
  await p.waitForTimeout(700);
  const inv = await p.evaluate(() => ({
    ficha: !document.querySelector('#ficha')?.hidden,
    fav: document.querySelector('#fichaFav')?.textContent.trim(),
    clase: document.querySelector('#fichaFav')?.className,
  }));
  await p.locator('#fichaFav').click({ force: true });
  await p.waitForTimeout(500);
  const desp = await p.evaluate(() => ({
    fav: document.querySelector('#fichaFav')?.textContent.trim(),
    clase: document.querySelector('#fichaFav')?.className,
    estrellas: document.querySelectorAll('#tablaEst .estrella').length,
  }));
  console.log('P8 favorito ficha:', JSON.stringify(inv), '→', JSON.stringify(desp));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}
await b.close();
