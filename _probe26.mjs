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
const ids = (p) => p.evaluate(() => [...document.querySelectorAll('#tablaEst tbody tr, [data-estacion]')]
  .map((e) => e.dataset.estacion || (e.querySelector('[data-comp]')?.dataset.comp) || '?').slice(0, 10));

/* P8: orden por JS directo */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  console.log('P8 base   ', JSON.stringify(await ids(p)), await p.evaluate(() => document.querySelector('#estSub')?.textContent));
  for (const d of ['precio-desc', 'dist', 'precio-asc']) {
    const r = await p.evaluate((dd) => {
      const btn = document.querySelector(`#ordenEst button[data-orden="${dd}"]`);
      if (!btn) return 'sin botón';
      const rect = btn.getBoundingClientRect();
      const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      btn.click();
      return { top: top ? top.tagName + '.' + top.className : null, pressed: btn.getAttribute('aria-pressed') };
    }, d);
    await p.waitForTimeout(500);
    console.log('P8 ' + d.padEnd(12), JSON.stringify(await ids(p)), JSON.stringify(r));
  }
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P8: comparador con los botones de la tabla */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const btns = [...document.querySelectorAll('#tablaEst [data-comp]')];
    btns[0].click(); btns[1].click();
    const f = document.querySelector('#fichaComparar');
    return { n: btns.length, fichaExiste: !!f, alto: f?.getBoundingClientRect().height, txt: (f?.innerText || '').replace(/\s+/g, ' ').slice(0, 200), opciones: document.querySelectorAll('#fichaComparar [data-comp]').length };
  });
  await p.waitForTimeout(400);
  const r2 = await p.evaluate(() => {
    const f = document.querySelector('#fichaComparar');
    return { alto: f?.getBoundingClientRect().height, visible: f ? getComputedStyle(f).display + '/' + getComputedStyle(f).visibility + '/' + f.hidden : null, txt: (f?.innerText || '').replace(/\s+/g, ' ').slice(0, 220) };
  });
  console.log('P8 comparador', JSON.stringify(r), '\n   luego', JSON.stringify(r2));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* P4: distancia */
{
  const { ctx, p, errs } = await abrir('prototipo4-modo-noche-conduccion');
  const m = () => p.evaluate(() => ({
    filas: document.querySelectorAll('[data-estacion], .estacion, .tarjeta, .fila-est').length,
    txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
    dist: document.querySelector('#distValor')?.textContent.trim(),
    rng: document.querySelector('#rngDist')?.value,
  }));
  const vista = p.locator('button:has-text("Lista"), [data-vista="lista"]').first();
  if (await vista.count()) { await vista.click({ force: true }); await p.waitForTimeout(700); }
  console.log('P4 lista antes', JSON.stringify(await m()));
  await p.evaluate(() => {
    const r = document.querySelector('#rngDist');
    r.value = '1';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(900);
  console.log('P4 lista 1 km ', JSON.stringify(await m()));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}
await b.close();
