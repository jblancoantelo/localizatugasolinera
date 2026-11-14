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
const snap = (p, sel) => p.evaluate((s) => {
  const e = s ? document.querySelector(s) : null;
  return { txt: (e?.innerText || document.body.innerText).replace(/\s+/g, ' ').slice(0, 160), n: document.querySelectorAll('[data-estacion], .tarjeta, [data-fila], tbody tr').length };
}, sel || '');

let fallos = 0;
const chk = (nombre, antes, desp, extra) => {
  const ok = antes.txt !== desp.txt || antes.n !== desp.n;
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${nombre.padEnd(34)} ${antes.n}→${desp.n}${extra ? ' | ' + extra : ''}`);
  if (!ok) console.log('        ', antes.txt.slice(0, 90), '||', desp.txt.slice(0, 90));
};

/* ---------- P7 explorar ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo7-asistente-decisiones');
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(700);
  let a = await snap(p);
  await p.selectOption('#filtroFuel', 'Gasóleo A');
  await p.waitForTimeout(600);
  let d = await snap(p);
  chk('P7 fuel Gasóleo A', a, d);
  await p.reload(); await p.waitForTimeout(700);
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(600);
  a = await snap(p);
  await p.locator('#filtroTexto').fill('Repsol');
  await p.waitForTimeout(600);
  d = await snap(p);
  chk('P7 buscador Repsol', a, d);
  await p.reload(); await p.waitForTimeout(700);
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(600);
  a = await snap(p);
  await p.locator('#vista-explorar button:has-text("Distancia"), [data-vista="explorar"] button:has-text("Distancia")').first().click({ force: true });
  await p.waitForTimeout(600);
  d = await snap(p);
  chk('P7 orden distancia', a, d);
  await p.reload(); await p.waitForTimeout(700);
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const favs = await p.evaluate(() => [...document.querySelectorAll('[data-vista="explorar"] [data-fav], #vista-explorar [data-fav]')].length);
  console.log('   P7 favoritos en explorar:', favs, '| errs', errs.slice(0, 1));
  await ctx.close();
}

/* ---------- P8 estaciones ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  let a = await snap(p);
  await p.locator('#buscar').fill('Repsol');
  await p.waitForTimeout(600);
  let d = await snap(p);
  chk('P8 buscador Repsol', a, d);
  await p.reload(); await p.waitForTimeout(700);
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(600);
  a = await snap(p);
  await p.locator('button:has-text("Precio ↓")').first().click({ force: true });
  await p.waitForTimeout(600);
  d = await snap(p);
  chk('P8 orden precio desc', a, d);
  await p.reload(); await p.waitForTimeout(700);
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(600);
  const comp = await p.evaluate(() => {
    const b1 = [...document.querySelectorAll('button')].find((x) => /comparar/i.test(x.textContent || ''));
    if (!b1) return { hay: false };
    b1.click();
    return { hay: true, txt: b1.textContent.trim() };
  });
  await p.waitForTimeout(600);
  const comp2 = await p.evaluate(() => {
    const otro = [...document.querySelectorAll('button')].find((x) => /comparar/i.test(x.textContent || ''));
    if (otro) otro.click();
    return { abierto: !!document.querySelector('#comparador:not([hidden]), .comparador:not([hidden])'), txt: (document.body.innerText.match(/comparad|comparador|frente a/i) || []).slice(0, 2) };
  });
  await p.waitForTimeout(700);
  console.log('   P8 comparar →', JSON.stringify(comp), JSON.stringify(comp2), '| errs', errs.slice(0, 1));
  await ctx.close();
}

/* ---------- P4 distancia ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo4-modo-noche-conduccion');
  const a = await snap(p);
  await p.evaluate(() => { const r = document.querySelector('#rngDist'); r.value = 1; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(700);
  const d = await snap(p);
  const valor = await p.evaluate(() => document.querySelector('#distValor')?.textContent.trim());
  chk('P4 distancia 1 km', a, d, 'distValor=' + valor);
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- P3: paginación ---------- */
{
  const { ctx, p } = await abrir('prototipo3-lista-tarjetas');
  const r = await p.evaluate(() => ({
    paginacion: !!document.querySelector('#paginacion, .paginacion, [data-pag]'),
    tarjetas: document.querySelectorAll('.tarjeta, [data-estacion]').length,
    botonesPag: [...document.querySelectorAll('button')].filter((x) => /p[áa]gina|siguiente|›|»/i.test((x.getAttribute('aria-label') || '') + (x.textContent || ''))).map((x) => x.textContent.trim().slice(0, 12)),
  }));
  console.log('   P3 paginación →', JSON.stringify(r).slice(0, 200));
  await ctx.close();
}

await b.close();
console.log('\nFALLOS:', fallos);
