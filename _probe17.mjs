import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
const abrir = async (dir, w = 1440, h = 900) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(750);
  return { ctx, p, errs };
};

/* --------- P1 marcas: estado interno de la hoja --------- */
{
  const { ctx, p, errs } = await abrir('prototipo1-mapa-hojas', 390, 844);
  await p.locator('[data-chip="marcas"]').first().click({ force: true });
  await p.waitForTimeout(500);
  const ini = await p.evaluate(() => ({ tipo: document.querySelector('#opcPie').dataset.tipo, sel: document.querySelector('#opcCuerpo')._sel ? [...document.querySelector('#opcCuerpo')._sel] : null, tieneAplicar: typeof document.querySelector('#opcCuerpo')._aplicar }));
  await p.locator('#opcCuerpo [data-opcion="Repsol"]').first().click({ force: true });
  await p.waitForTimeout(300);
  const tras = await p.evaluate(() => ({ sel: document.querySelector('#opcCuerpo')._sel ? [...document.querySelector('#opcCuerpo')._sel] : null, elegida: document.querySelector('#opcCuerpo [data-opcion="Repsol"]').className }));
  await p.locator('#opcPie button:has-text("Ver resultados")').first().click({ force: true });
  await p.waitForTimeout(600);
  const fin = await p.evaluate(() => ({ chip: document.querySelector('[data-chip="marcas"]').textContent.trim(), marcas: document.querySelector('[data-chip="marcas"]').className, filas: document.querySelectorAll('[data-estacion]').length, hoja: !!document.querySelector('#hojaOpciones:not([hidden])') }));
  console.log('P1 marcas →', JSON.stringify({ ini, tras, fin }));
  if (errs.length) console.log(' errs', errs.slice(0, 3));
  await ctx.close();
}

/* --------- P5 pageSize --------- */
{
  const { ctx, p, errs } = await abrir('prototipo5-split-comparador');
  const m = () => p.evaluate(() => ({
    tr: document.querySelectorAll('tbody tr').length,
    filas: document.querySelectorAll('[data-fila]').length,
    pag: document.querySelector('#paginacion .pag-info')?.textContent.trim(),
    ps: document.querySelector('#pageSizeSel')?.value,
    dup: document.querySelectorAll('#pageSizeSel').length,
    pagHTML: (document.querySelector('#paginacion')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
  }));
  console.log('P5 antes   ', JSON.stringify(await m()));
  await p.selectOption('#pageSizeSel', '15');
  await p.waitForTimeout(700);
  console.log('P5 size 15 ', JSON.stringify(await m()));
  await p.selectOption('#pageSizeSel', '50');
  await p.waitForTimeout(700);
  console.log('P5 size 50 ', JSON.stringify(await m()));
  await p.evaluate(() => {
    const s = document.querySelector('#pageSizeSel');
    s.value = '15';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(700);
  console.log('P5 change J', JSON.stringify(await m()));
  if (errs.length) console.log(' errs', errs.slice(0, 3));
  await ctx.close();
}

/* --------- P8 días --------- */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  const m = () => p.evaluate(() => ({
    valor: document.querySelector('#selDias')?.value,
    cabeceras: [...document.querySelectorAll('h2, h3, .card-titulo, .kpi-et')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /d[íi]a/i.test(t)).slice(0, 6),
    textos: (document.body.innerText.match(/[Úú]ltimos\s*\d+\s*d[íi]as|\d+\s*d[íi]as/g) || []).slice(0, 6),
    canvas: [...document.querySelectorAll('canvas')].map((c) => c.id + ':' + c.getBoundingClientRect().width + 'x' + c.getBoundingClientRect().height),
  }));
  console.log('P8 antes  ', JSON.stringify(await m()));
  await p.selectOption('#selDias', '30 días');
  await p.waitForTimeout(900);
  console.log('P8 dias 30', JSON.stringify(await m()));
  await p.evaluate(() => {
    const s = document.querySelector('#selDias');
    s.value = '60';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(900);
  console.log('P8 dias 60', JSON.stringify(await m()));
  if (errs.length) console.log(' errs', errs.slice(0, 3));
  await ctx.close();
}
await b.close();
