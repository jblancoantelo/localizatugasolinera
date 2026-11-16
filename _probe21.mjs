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

/* P1: marca y distancia con el toast ya retirado al abrir la hoja */
{
  const { ctx, p, errs } = await abrir('prototipo1-mapa-hojas', 390, 844);
  await p.locator('[data-chip="marcas"]').first().click({ force: true });
  await p.waitForTimeout(400);
  const top = await p.evaluate(() => {
    const op = document.querySelector('#opcCuerpo [data-opcion="Repsol"]');
    const r = op.getBoundingClientRect();
    const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { top: t ? t.tagName + '#' + t.id + '.' + t.className : null, dentro: op === t || op.contains(t), aviso: document.querySelector('#aviso').hidden };
  });
  await p.locator('#opcCuerpo [data-opcion="Repsol"]').first().click({ force: true });
  await p.waitForTimeout(250);
  await p.locator('#opcPie button:has-text("Ver resultados")').first().click({ force: true });
  await p.waitForTimeout(700);
  const res = await p.evaluate(() => ({ chip: document.querySelector('[data-chip="marcas"]').textContent.trim(), filas: document.querySelectorAll('[data-estacion]').length }));
  console.log('P1 marca →', JSON.stringify(top), JSON.stringify(res));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P1: todas las provincias + distancia (regresión del slider) */
{
  const { ctx, p } = await abrir('prototipo1-mapa-hojas', 390, 844);
  await p.locator('[data-chip="prov"]').first().click({ force: true });
  await p.waitForTimeout(400);
  await p.locator('#opcPie button:has-text("Todas")').first().click({ force: true });
  await p.waitForTimeout(600);
  const antes = await p.evaluate(() => document.querySelectorAll('[data-estacion]').length);
  await p.locator('[data-chip="dist"]').first().click({ force: true });
  await p.waitForTimeout(400);
  await p.evaluate(() => { const r = document.querySelector('#opcCuerpo input[type="range"]'); r.value = 6; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.locator('#opcPie button:has-text("Aplicar")').first().click({ force: true });
  await p.waitForTimeout(600);
  const desp = await p.evaluate(() => ({ filas: document.querySelectorAll('[data-estacion]').length, chip: document.querySelector('[data-chip="dist"]').textContent.trim() }));
  console.log('P1 todas + 6 km →', antes, '→', JSON.stringify(desp));
  await ctx.close();
}

/* P5: todas las provincias y pageSize 15 */
{
  const { ctx, p, errs } = await abrir('prototipo5-split-comparador');
  await p.selectOption('#fProvincia', 'Todas las provincias');
  await p.waitForTimeout(700);
  const antes = await p.evaluate(() => ({ tr: document.querySelectorAll('tbody tr').length, info: document.querySelector('#paginacion .pag-info').textContent.trim() }));
  await p.selectOption('#pageSizeSel', '15');
  await p.waitForTimeout(700);
  const desp = await p.evaluate(() => ({ tr: document.querySelectorAll('tbody tr').length, info: document.querySelector('#paginacion .pag-info').textContent.trim() }));
  console.log('P5 pageSize →', JSON.stringify(antes), '→', JSON.stringify(desp));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P6 / P7: toast no bloquea (comprobación de pointer-events) */
for (const dir of ['prototipo6-gestos-atajos', 'prototipo7-asistente-decisiones']) {
  const { ctx, p } = await abrir(dir, 390, 844);
  const r = await p.evaluate(() => {
    const a = document.querySelector('#aviso');
    if (!a) return 'sin #aviso';
    /* forzar visible y comprobar que un punto bajo él sigue siendo clicable */
    a.hidden = false; a.classList.add('visible');
    const rect = a.getBoundingClientRect();
    const t = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { pe: getComputedStyle(a).pointerEvents, top: t ? t.tagName + '#' + t.id + '.' + t.className : null };
  });
  console.log(dir, 'toast →', JSON.stringify(r));
  await ctx.close();
}
await b.close();
