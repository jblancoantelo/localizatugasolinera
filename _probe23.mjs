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
const precios = (p) => p.evaluate(() => [...document.querySelectorAll('.precio, .tarjeta-precio b, .precio-valor, .fila-precio, td.precio, .est-precio')]
  .map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 14)).slice(0, 6));

/* P7: orden en explorar */
{
  const { ctx, p, errs } = await abrir('prototipo7-asistente-decisiones');
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(700);
  const antes = await precios(p);
  const ops = await p.evaluate(() => [...document.querySelectorAll('[data-vista="explorar"] button, #vista-explorar button')].map((x) => (x.textContent || '').trim().slice(0, 16) + ' ' + [...x.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value).join(',')));
  await p.locator('#vista-explorar button:has-text("Precio"), [data-vista="explorar"] button:has-text("Precio")').first().click({ force: true });
  await p.waitForTimeout(700);
  const trasPrecio = await precios(p);
  const dist = p.locator('#vista-explorar button:has-text("Distancia"), [data-vista="explorar"] button:has-text("Distancia")').first();
  await dist.click({ force: true });
  await p.waitForTimeout(700);
  const trasDist = await precios(p);
  console.log('P7 antes', JSON.stringify(antes), '\n   precio', JSON.stringify(trasPrecio), '\n   dist  ', JSON.stringify(trasDist), '\n   botones', JSON.stringify(ops).slice(0, 300));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P8: orden y comparador en estaciones */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  const antes = await precios(p);
  await p.locator('button:has-text("Precio ↓")').first().click({ force: true });
  await p.waitForTimeout(700);
  const desp = await precios(p);
  const info = await p.evaluate(() => ({
    comparar: [...document.querySelectorAll('[data-comparar], [data-comp], .btn-comparar')].slice(0, 4).map((x) => x.tagName + '[' + [...x.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value).join(',') + ']=' + x.textContent.trim().slice(0, 12)),
    barra: [...document.querySelectorAll('[id*="compar" i], [class*="compar" i]')].map((x) => (x.id || x.className) + (x.hidden ? '(oculto)' : '')).slice(0, 6),
  }));
  console.log('P8 orden →', JSON.stringify(antes), '→', JSON.stringify(desp), '\n   comparar:', JSON.stringify(info));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P4: distancia en vista lista */
{
  const { ctx, p, errs } = await abrir('prototipo4-modo-noche-conduccion');
  const vista = p.locator('button:has-text("Lista"), [data-vista="lista"]').first();
  if (await vista.count()) { await vista.click({ force: true }); await p.waitForTimeout(700); }
  const antes = await p.evaluate(() => ({
    n: document.querySelectorAll('[data-estacion], .tarjeta, .estacion, .fila').length,
    precios: [...document.querySelectorAll('.precio, .precio-valor, b')].slice(0, 5).map((e) => e.textContent.trim().slice(0, 10)).join(','),
    txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 140),
  }));
  await p.evaluate(() => { const r = document.querySelector('#rngDist'); if (r) { r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true })); } });
  await p.waitForTimeout(800);
  const desp = await p.evaluate(() => ({
    n: document.querySelectorAll('[data-estacion], .tarjeta, .estacion, .fila').length,
    precios: [...document.querySelectorAll('.precio, .precio-valor, b')].slice(0, 5).map((e) => e.textContent.trim().slice(0, 10)).join(','),
    txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 140),
    dist: document.querySelector('#distValor')?.textContent.trim(),
  }));
  console.log('P4 distancia →', JSON.stringify(antes), '→', JSON.stringify(desp));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}
await b.close();
