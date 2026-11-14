import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const casos = ['prototipo2-escritorio-sala-de-control', 'prototipo3-lista-tarjetas', 'prototipo4-modo-noche-conduccion', 'prototipo7-asistente-decisiones', 'prototipo8-panel-de-datos'];

const b = await chromium.launch();
for (const dir of casos) {
  console.log('\n######## ' + dir);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(2500);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);

  /* --- detalle --- */
  const trig = p.locator('[data-shot="detalle"]:visible, [data-accion="abrir-detalle"]:visible').first();
  if (await trig.count()) {
    await trig.click({ force: true }).catch(() => {});
    await p.waitForTimeout(900);
    const info = await p.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden';
      };
      const svgs = [...document.querySelectorAll('svg')].filter(vis);
      const conGrafica = svgs.filter((s) => s.querySelector('polyline[points], path[d*="L"], circle, rect'));
      const svgGrande = svgs.filter((s) => s.getBoundingClientRect().width > 140 && s.getBoundingClientRect().height > 60);
      const selects = [...document.querySelectorAll('select')].filter(vis).map((s) => s.id + ':' + s.options.length);
      const botones = [...document.querySelectorAll('button')].filter(vis).map((b) => (b.textContent || '').trim()).filter((t) => t && t.length < 14);
      return { svgs: svgs.length, svgGrande: svgGrande.length, conGrafica: conGrafica.length, selects, botones: botones.slice(0, 24) };
    });
    console.log(' detalle:', JSON.stringify(info));
  } else console.log(' detalle: sin disparador visible');

  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(300);

  /* --- config / ajustes --- */
  for (const sel of ['button[data-destino="ajustes"]', 'button[data-vista="ajustes"]', 'button[data-vista="config"]', 'button[data-destino="config"]']) {
    const loc = p.locator(sel).first();
    if (!(await loc.count())) continue;
    await loc.click({ force: true }).catch(() => {});
    await p.waitForTimeout(700);
    const txt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500));
    console.log(' ' + sel + ' →', txt.slice(0, 300));
    await p.keyboard.press('Escape').catch(() => {});
    await p.waitForTimeout(250);
  }

  /* --- filtros: comparar panel completo --- */
  const res = await p.evaluate(() => {
    const sels = [...document.querySelectorAll('select')];
    const sel = sels.find((s) => [...s.options].some((o) => /madrid|barcelona|valencia/i.test(o.textContent)));
    if (!sel) return { hay: false };
    const zonas = ['#lista', '#listaTarjetas', '#listaScroll', '#panel', '#contenido', '#explorar', 'main', '#resultados', '.panel-datos', '#kpis'];
    const snap = () => zonas.map((z) => { const e = document.querySelector(z); return e ? e.innerText.replace(/\s+/g, ' ').length : 0; });
    const antes = { snap: snap(), textos: zonas.map((z) => { const e = document.querySelector(z); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 90) : ''; }) };
    const idx = [...sel.options].findIndex((o) => o.value && o.value !== sel.value);
    if (idx < 0) return { hay: true, ok: false };
    sel.value = sel.options[idx].value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { hay: true, ok: true, antes };
  });
  await p.waitForTimeout(700);
  if (res.hay) {
    const des = await p.evaluate(() => {
      const zonas = ['#lista', '#listaTarjetas', '#listaScroll', '#panel', '#contenido', '#explorar', 'main', '#resultados', '.panel-datos', '#kpis'];
      return { snap: zonas.map((z) => { const e = document.querySelector(z); return e ? e.innerText.replace(/\s+/g, ' ').length : 0; }), textos: zonas.map((z) => { const e = document.querySelector(z); return e ? e.innerText.replace(/\s+/g, ' ').slice(0, 90) : ''; }) };
    });
    const cambio = JSON.stringify(res.antes.snap) !== JSON.stringify(des.snap) || JSON.stringify(res.antes.textos) !== JSON.stringify(des.textos);
    console.log(' filtro provincia →', cambio ? 'CAMBIA' : 'sin cambio', '| antes', res.antes.snap, '| despues', des.snap);
  } else console.log(' filtro provincia: no hay select');

  if (errs.length) console.log(' ERRORES:', errs.slice(0, 3));
  await ctx.close();
}
await b.close();
