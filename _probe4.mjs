import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

async function abrir(dir, w = 1440, h = 900) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  return { ctx, p, errs };
}

/* ============ P2: provincia + histórico SVG ============ */
{
  const { ctx, p, errs } = await abrir('prototipo2-escritorio-sala-de-control');
  const antes = await p.evaluate(() => document.querySelector('#listaCuerpo, .lista-cuerpo, #listaTarjetas')?.innerText?.replace(/\s+/g, ' ').slice(0, 120));
  await p.locator('#chipProvincia').click({ force: true }).catch(() => {});
  await p.waitForTimeout(500);
  const opciones = await p.evaluate(() => [...document.querySelectorAll('[role="option"], .desp-opcion, .opcion')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent.trim()).slice(0, 8));
  const bcn = p.locator('[role="option"]:has-text("Barcelona"), .desp-opcion:has-text("Barcelona"), .opcion:has-text("Barcelona")').first();
  if (await bcn.count()) await bcn.click({ force: true }).catch(() => {});
  await p.waitForTimeout(900);
  const pos = await p.evaluate(() => ({
    chip: document.querySelector('#chipProvinciaVal')?.textContent,
    filas: document.querySelectorAll('[data-fila]').length,
    lista: document.querySelector('#listaCuerpo')?.innerText?.replace(/\s+/g, ' ').slice(0, 120),
  }));
  console.log('P2 provincia: opciones', JSON.stringify(opciones), '→', JSON.stringify(pos), '| antes:', antes);

  const trig = p.locator('[data-accion="abrir-detalle"]').first();
  await trig.click({ force: true }).catch(() => {});
  await p.waitForTimeout(700);
  const tabh = p.locator('button:has-text("Histórico")').first();
  if (await tabh.count()) { await tabh.click({ force: true }).catch(() => {}); await p.waitForTimeout(800); }
  const hist = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    return {
      svgGrande: [...document.querySelectorAll('svg')].filter(vis).filter((s) => s.getBoundingClientRect().width > 140 && s.getBoundingClientRect().height > 60).length,
      selects: [...document.querySelectorAll('select')].filter(vis).map((s) => s.id + ':' + s.options.length),
      metricas: (document.body.innerText.match(/Mínimo|Máximo|Media|días|tendencia/gi) || []),
    };
  });
  console.log('P2 histórico:', JSON.stringify(hist));
  if (errs.length) console.log('P2 errs', errs);
  await ctx.close();
}

/* ============ P1 / P6: chip de provincia ============ */
for (const dir of ['prototipo1-mapa-hojas', 'prototipo6-gestos-atajos']) {
  const { ctx, p, errs } = await abrir(dir, 390, 844);
  const chip = p.locator('button:has-text("Provincia"), [data-hoja="provincia"], [data-accion="hoja"]').first();
  const hay = await chip.count();
  let salida = { hayChip: !!hay };
  if (hay) {
    const antes = await p.evaluate(() => (document.querySelector('#listaTarjetas, #listaHoja, #listaScroll')?.innerText || '').replace(/\s+/g, ' ').length);
    await chip.click({ force: true }).catch(() => {});
    await p.waitForTimeout(600);
    const ops = await p.evaluate(() => [...document.querySelectorAll('button, [role="option"], li')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 20 && r.width > 40 && /madrid|barcelona|valencia/i.test(e.textContent); }).map((e) => e.textContent.trim()).slice(0, 6));
    const bcn = p.locator('button:has-text("Barcelona"), [role="option"]:has-text("Barcelona"), li:has-text("Barcelona")').first();
    if (await bcn.count()) await bcn.click({ force: true }).catch(() => {});
    await p.waitForTimeout(900);
    // abrir la hoja de lista si está plegada
    const despues = await p.evaluate(() => ({
      largo: (document.querySelector('#listaTarjetas, #listaHoja, #listaScroll')?.innerText || '').replace(/\s+/g, ' ').length,
      txt: (document.body.innerText.match(/Madrid|Barcelona|Valencia/g) || []).slice(0, 6),
      cabecera: document.body.innerText.replace(/\s+/g, ' ').slice(0, 140),
    }));
    salida = { hayChip: true, opciones: ops, antes, despues };
  }
  console.log(dir, '→', JSON.stringify(salida));
  if (errs.length) console.log(dir, 'errs', errs);
  await ctx.close();
}

/* ============ P1: tooltip ============ */
{
  const { ctx, p } = await abrir('prototipo1-mapa-hojas');
  const trig = p.locator('[data-shot="detalle"]').first();
  await trig.click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const canvas = p.locator('#histCanvas').first();
  const hay = await canvas.count();
  let tip = null;
  if (hay) {
    const box = await canvas.boundingBox();
    if (box) {
      await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await p.waitForTimeout(400);
      tip = await p.evaluate(() => {
        const cands = [...document.querySelectorAll('div, span')].filter((e) => {
          const r = e.getBoundingClientRect();
          const cs = getComputedStyle(e);
          return r.width > 30 && r.height > 14 && r.width < 240 && /^\s*\d,\d{3}\s*€/.test(e.textContent || '') && /dd|mm|\d{2}-\d{2}/.test(e.textContent || '') && cs.visibility !== 'hidden';
        });
        return cands.map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3);
      });
    }
  }
  console.log('P1 tooltip:', JSON.stringify(tip));
  await ctx.close();
}

/* ============ P7 / P8: favorito en la ficha ============ */
for (const dir of ['prototipo7-asistente-decisiones', 'prototipo8-panel-de-datos']) {
  const { ctx, p, errs } = await abrir(dir);
  await p.locator('[data-shot="detalle"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const fav = p.locator('button:has-text("Favorita")').first();
  let res = { hayFav: !!(await fav.count()) };
  if (res.hayFav) {
    const antes = await fav.evaluate((el) => ({ txt: el.textContent.trim(), cls: el.className, aria: el.getAttribute('aria-pressed') }));
    await fav.click({ force: true }).catch(() => {});
    await p.waitForTimeout(600);
    const despues = await fav.evaluate((el) => ({ txt: el.textContent.trim(), cls: el.className, aria: el.getAttribute('aria-pressed') }));
    res = { ...res, antes, despues, cambia: JSON.stringify(antes) !== JSON.stringify(despues) };
  }
  console.log(dir, 'favorito →', JSON.stringify(res));
  if (errs.length) console.log(dir, 'errs', errs);
  await ctx.close();
}

/* ============ P7: config completo ============ */
{
  const { ctx, p } = await abrir('prototipo7-asistente-decisiones');
  await p.locator('button[data-vista="config"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(700);
  const txt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  console.log('P7 config tiene claves:', /clave|api key/i.test(txt), '| version:', /versi/i.test(txt), '| logs:', /registro|log/i.test(txt));
  await ctx.close();
}

await b.close();
