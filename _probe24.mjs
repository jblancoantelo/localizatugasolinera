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
const ids = (p) => p.evaluate(() => {
  const out = [...document.querySelectorAll('[data-estacion], [data-fav], [data-comp], [data-detalle], [data-fila]')]
    .map((e) => e.dataset.estacion || e.dataset.fav || e.dataset.comp || e.dataset.detalle || e.dataset.fila);
  return [...new Set(out)].slice(0, 8);
});

/* P7: orden */
{
  const { ctx, p } = await abrir('prototipo7-asistente-decisiones');
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(700);
  const antes = await ids(p);
  await p.locator('[data-orden="precio"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const a = await ids(p);
  await p.locator('[data-orden="dist"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const c = await ids(p);
  await p.locator('[data-orden="marca"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const d = await ids(p);
  console.log('P7 orden: base', JSON.stringify(antes), '\n  precio', JSON.stringify(a), '\n  dist  ', JSON.stringify(c), '\n  marca ', JSON.stringify(d));
  await ctx.close();
}

/* P8: orden */
{
  const { ctx, p } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  const antes = await ids(p);
  await p.locator('button:has-text("Precio ↓")').first().click({ force: true });
  await p.waitForTimeout(600);
  const a = await ids(p);
  await p.locator('button:has-text("Distancia")').first().click({ force: true });
  await p.waitForTimeout(600);
  const d = await ids(p);
  console.log('P8 orden: base', JSON.stringify(antes), '\n  precio↓', JSON.stringify(a), '\n  dist   ', JSON.stringify(d));
  await ctx.close();
}

/* P8: comparador con 2 estaciones */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  await p.locator('[data-comp]').nth(0).click({ force: true });
  await p.waitForTimeout(300);
  await p.locator('[data-comp]').nth(1).click({ force: true });
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const f = document.querySelector('#fichaComparar');
    return { existe: !!f, visible: f ? f.getBoundingClientRect().height > 4 && !f.hidden : null, txt: (f?.innerText || '').replace(/\s+/g, ' ').slice(0, 160), comprando: [...document.querySelectorAll('[data-comp].on, [data-comp][aria-pressed="true"]')].length };
  });
  console.log('P8 comparador →', JSON.stringify(r));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P4: distancia (input + change) y conteo de tarjetas */
{
  const { ctx, p } = await abrir('prototipo4-modo-noche-conduccion');
  const m = () => p.evaluate(() => ({
    n: new Set([...document.querySelectorAll('[data-estacion], [data-id], .estacion, .tarjeta')].map((e) => e.dataset.estacion || e.dataset.id || e.className)).size,
    txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120),
    dist: document.querySelector('#distValor')?.textContent.trim(),
  }));
  console.log('P4 antes   ', JSON.stringify(await m()));
  await p.evaluate(() => {
    const r = document.querySelector('#rngDist');
    r.value = 1;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(900);
  console.log('P4 dist 1  ', JSON.stringify(await m()));
  await ctx.close();
}
await b.close();
