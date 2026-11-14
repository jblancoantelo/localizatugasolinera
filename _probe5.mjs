import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

for (const dir of ['prototipo1-mapa-hojas', 'prototipo6-gestos-atajos']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);

  const chipProv = p.locator('button:has-text("Provincia")').first();
  const listaSel = '#listaTarjetas, #listaHoja, #listaScroll';
  const antes = await p.evaluate((s) => (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').slice(0, 90), listaSel);
  await chipProv.click({ force: true }).catch(() => {});
  await p.waitForTimeout(500);
  const opciones = await p.evaluate(() => [...document.querySelectorAll('#opcCuerpo .opcion')].map((e) => e.textContent.trim()));
  const bcn = p.locator('#opcCuerpo .opcion', { hasText: 'Barcelona' }).first();
  let clicErr = null;
  if (await bcn.count()) await bcn.click().catch((e) => { clicErr = e.message.split('\n')[0]; });
  await p.waitForTimeout(800);
  const pie = await p.evaluate(() => [...document.querySelectorAll('#opcPie button')].map((e) => e.textContent.trim()));
  const post = await p.evaluate((s) => ({
    txt: (document.querySelector(s)?.innerText || '').replace(/\s+/g, ' ').slice(0, 90),
    cab: document.body.innerText.replace(/\s+/g, ' ').slice(0, 110),
    hojaAbierta: !!document.querySelector('#hojaOpciones:not([hidden])'),
  }), listaSel);
  console.log('\n' + dir, JSON.stringify({ antes, opciones: opciones.slice(0, 6), clicErr, pie, post }, null, 1));

  /* tooltip: recorrer el canvas y buscar cualquier caja pequeña nueva */
  const trig = p.locator('[data-shot="detalle"]').first();
  await trig.click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const tabh = p.locator('button:has-text("Histórico")').first();
  if (await tabh.count()) { await tabh.click({ force: true }).catch(() => {}); await p.waitForTimeout(700); }
  const canvas = p.locator('#histCanvas').first();
  let tips = [];
  if (await canvas.count()) {
    const box = await canvas.boundingBox();
    if (box) {
      for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        await p.mouse.move(box.x + box.width * f, box.y + box.height * 0.5);
        await p.waitForTimeout(180);
        const t = await p.evaluate(() => {
          const out = [];
          document.querySelectorAll('div, span').forEach((e) => {
            const r = e.getBoundingClientRect();
            const cs = getComputedStyle(e);
            const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
            if (r.width > 26 && r.width < 260 && r.height > 12 && r.height < 90 && cs.visibility !== 'hidden' &&
              cs.position !== 'static' && /\d,\d{3}/.test(txt) && txt.length < 60) out.push(txt);
          });
          return [...new Set(out)].slice(0, 2);
        });
        if (t.length) tips.push(...t);
      }
    }
  }
  console.log(dir, 'tooltip →', JSON.stringify([...new Set(tips)]), 'errs', errs.slice(0, 2));
  await ctx.close();
}
await b.close();
