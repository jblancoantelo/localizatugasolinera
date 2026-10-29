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

/* ---- P8: ¿llega el change? ---- */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  const r = await p.evaluate(() => {
    window.__ch = 0;
    document.addEventListener('change', () => { window.__ch++; });
    const todos = [...document.querySelectorAll('#selDias')];
    const s = todos[0];
    s.value = '60';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return { copias: todos.length, valor: s.value, ch: window.__ch, visibles: todos.map((x) => { const r2 = x.getBoundingClientRect(); return r2.width + 'x' + r2.height; }) };
  });
  await p.waitForTimeout(500);
  const visible = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#selDias')].map((x) => x.value);
    const canvas = [...document.querySelectorAll('canvas')].map((c) => c.id);
    const textos = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /d[íi]as/i.test(e.textContent || '')).map((e) => e.textContent.trim()).slice(0, 8);
    return { valores: t, canvas, textos };
  });
  console.log('P8 change →', JSON.stringify(r), '| luego', JSON.stringify(visible));
  if (errs.length) console.log(' errs', errs.slice(0, 3));
  await ctx.close();
}

/* ---- P5: ¿llega el change a #paginacion? ---- */
{
  const { ctx, p, errs } = await abrir('prototipo5-split-comparador');
  const r = await p.evaluate(() => {
    window.__ch = 0;
    document.addEventListener('change', () => { window.__ch++; }, true);
    const s = document.querySelector('#pageSizeSel');
    const antes = document.querySelectorAll('tbody tr').length;
    s.value = '15';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return { antes, valor: s.value, ch: window.__ch, enPag: !!s.closest('#paginacion') };
  });
  await p.waitForTimeout(700);
  const desp = await p.evaluate(() => ({
    tr: document.querySelectorAll('tbody tr').length,
    info: document.querySelector('#paginacion .pag-info')?.textContent.trim(),
    valor: document.querySelector('#pageSizeSel')?.value,
  }));
  console.log('P5 change →', JSON.stringify(r), '| luego', JSON.stringify(desp));
  if (errs.length) console.log(' errs', errs.slice(0, 3));
  await ctx.close();
}

/* ---- P1: ¿se procesa el clic en la opción múltiple? ---- */
{
  const { ctx, p, errs } = await abrir('prototipo1-mapa-hojas', 390, 844);
  await p.locator('[data-chip="marcas"]').first().click({ force: true });
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const op = document.querySelector('#opcCuerpo [data-opcion="Repsol"]');
    const c = document.querySelector('#opcCuerpo');
    const antes = { tipo: document.querySelector('#opcPie').dataset.tipo, sel: c._sel ? [...c._sel] : null };
    const rect = op.getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { antes, topEl: top ? top.tagName + '.' + top.className + '#' + top.id : null, enOpcion: top === op || op.contains(top), rect: [rect.x, rect.y, rect.width, rect.height] };
  });
  await p.locator('#opcCuerpo [data-opcion="Repsol"]').first().click({ force: true });
  await p.waitForTimeout(400);
  const tras = await p.evaluate(() => {
    const c = document.querySelector('#opcCuerpo');
    return {
      sel: c._sel ? [...c._sel] : null,
      clase: document.querySelector('#opcCuerpo [data-opcion="Repsol"]').className,
      hoja: !!document.querySelector('#hojaOpciones:not([hidden])'),
      filas: document.querySelectorAll('[data-estacion]').length,
    };
  });
  console.log('P1 clic opción →', JSON.stringify(r), '| tras', JSON.stringify(tras));
  if (errs.length) console.log(' errs', errs.slice(0, 3));
  await ctx.close();
}
await b.close();
