import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

async function abrir(dir) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  return { ctx, p, errs };
}

/* ---------- P3: detalle (histórico) y ajustes ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo3-lista-tarjetas');
  const trig = p.locator('[data-shot="detalle"]').first();
  await trig.click();
  await p.waitForTimeout(800);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('button')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && /hist|precio/i.test(b.textContent);
  }).map((b) => ({ txt: b.textContent.trim(), cls: b.className })));
  const hist = p.locator('button:has-text("Histórico")').first();
  if (await hist.count()) { await hist.click({ force: true }).catch(() => {}); await p.waitForTimeout(700); }
  const med = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    return {
      tabs: [...document.querySelectorAll('button')].filter(vis).map((b) => b.textContent.trim()).filter((t) => t && t.length < 16).slice(0, 30),
      selects: [...document.querySelectorAll('select')].filter(vis).map((s) => s.id + ':' + s.options.length),
      svgGrande: [...document.querySelectorAll('svg')].filter(vis).filter((s) => s.getBoundingClientRect().width > 140 && s.getBoundingClientRect().height > 60).length,
      textoHist: (document.body.innerText.match(/Mínimo|Máximo|Media|días/gi) || []).length,
    };
  });
  console.log('P3 tabs/hist:', JSON.stringify(tabs));
  console.log('P3 tras Histórico:', JSON.stringify(med));
  // cerrar detalle
  const cerrar = p.locator('#detalleCerrar').first();
  if (await cerrar.count()) await cerrar.click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  const nav = p.locator('button[data-destino="ajustes"]').first();
  await nav.click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const cfg = await p.evaluate(() => ({
    visibleSheet: !!document.querySelector('#capaAjustes:not([hidden])'),
    txt: (document.querySelector('#ajustesCuerpo')?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  }));
  console.log('P3 ajustes:', JSON.stringify(cfg));
  if (errs.length) console.log('P3 errs', errs);
  await ctx.close();
}

/* ---------- P7: explorar + filtros ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo7-asistente-decisiones');
  await p.locator('button[data-vista="explorar"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const antes = await p.evaluate(() => {
    const el = document.querySelector('[data-vista="explorar"]');
    return (document.body.innerText.replace(/\s+/g, ' ')).slice(0, 400);
  });
  const cambio = await p.evaluate(() => {
    const sels = [...document.querySelectorAll('select')].filter((s) => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const prov = sels.find((s) => [...s.options].some((o) => /madrid|barcelona|valencia/i.test(o.textContent)));
    if (!prov) return { hay: false, sels: sels.map((s) => s.id + ':' + s.options.length) };
    const antes = document.body.innerText.replace(/\s+/g, ' ').length;
    const idx = [...prov.options].findIndex((o) => o.value && o.value !== prov.value);
    prov.value = prov.options[idx].value;
    prov.dispatchEvent(new Event('change', { bubbles: true }));
    return { hay: true, id: prov.id, antes };
  });
  await p.waitForTimeout(800);
  const despues = await p.evaluate(() => ({ largo: document.body.innerText.replace(/\s+/g, ' ').length, txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300) }));
  console.log('P7 select:', JSON.stringify(cambio), '→', despues.largo, '|', despues.txt.slice(0, 160));
  if (errs.length) console.log('P7 errs', errs);
  await ctx.close();
}

/* ---------- P8: panel + filtros ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  const antes = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
  const cambio = await p.evaluate(() => {
    const sels = [...document.querySelectorAll('select')].filter((s) => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const prov = sels.find((s) => [...s.options].some((o) => /madrid|barcelona|valencia/i.test(o.textContent)));
    if (!prov) return { hay: false };
    const idx = [...prov.options].findIndex((o) => o.value && o.value !== prov.value);
    prov.value = prov.options[idx].value;
    prov.dispatchEvent(new Event('change', { bubbles: true }));
    return { hay: true, id: prov.id, valor: prov.value };
  });
  await p.waitForTimeout(900);
  const despues = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
  console.log('P8 select:', JSON.stringify(cambio));
  console.log('  antes :', antes.slice(0, 180));
  console.log('  despues:', despues.slice(0, 180));
  console.log('  cambia:', antes !== despues);
  if (errs.length) console.log('P8 errs', errs);
  await ctx.close();
}

await b.close();
