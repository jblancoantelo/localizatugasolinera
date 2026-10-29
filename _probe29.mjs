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
const resumen = (p) => p.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, ' ');
  return {
    estaciones: (t.match(/(\d+)\s*estaciones/i) || [])[1] || '',
    filas: document.querySelectorAll('[data-fila], [data-estacion], [data-id], tbody tr, .tarjeta').length,
    precios: [...document.querySelectorAll('.precio, .tarjeta-precio b, .precio-valor, .fila-precio, td.precio, .est-precio, .rk-precio, .pildora')].slice(0, 4).map((e) => e.textContent.trim().slice(0, 12)),
    vacio: !!document.querySelector('.vacio, .vacia, .sin-resultados, [data-vacio]'),
  };
});

let fallos = 0;
const chk = (nombre, a, d, extra = '') => {
  const ok = JSON.stringify(a.precios) !== JSON.stringify(d.precios) || a.filas !== d.filas || a.estaciones !== d.estaciones || a.vacio !== d.vacio;
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${nombre.padEnd(30)} filas ${a.filas}→${d.filas} est ${a.estaciones || '-'}→${d.estaciones || '-'}${extra ? ' | ' + extra : ''}`);
  if (!ok) console.log('        ', JSON.stringify(a).slice(0, 150), '||', JSON.stringify(d).slice(0, 150));
};

/* ---------- P2: marcas dentro del desplegable de filtros ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo2-escritorio-sala-de-control');
  const a = await resumen(p);
  await p.locator('[data-desplegable="filtros"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const inv = await p.evaluate(() => {
    const d = document.querySelector('#desplegable');
    return {
      abierto: !!d && !d.hidden,
      texto: (d?.innerText || '').replace(/\s+/g, ' ').slice(0, 220),
      checks: [...(d?.querySelectorAll('input[type="checkbox"]') || [])].map((c) => c.value + '/' + c.checked).slice(0, 8),
      botones: [...(d?.querySelectorAll('button') || [])].map((x) => x.textContent.trim().slice(0, 18)).slice(0, 8),
    };
  });
  console.log('P2 desplegable filtros:', JSON.stringify(inv).slice(0, 400));
  const chkRepsol = p.locator('#desplegable label', { hasText: 'Repsol' }).first();
  if (await chkRepsol.count()) await chkRepsol.click({ force: true });
  await p.waitForTimeout(700);
  const d = await resumen(p);
  chk('P2 marca Repsol', a, d);
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- P4: marcas ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo4-modo-noche-conduccion');
  const a = await resumen(p);
  await p.locator('#btnMarcas').click({ force: true });
  await p.waitForTimeout(400);
  const inv = await p.evaluate(() => ({
    oculto: document.querySelector('#marcasLista')?.hidden,
    n: document.querySelectorAll('#marcasChecks input[data-marca]').length,
    marcas: [...document.querySelectorAll('#marcasChecks input[data-marca]')].slice(0, 6).map((i) => i.getAttribute('data-marca')),
  }));
  const m = p.locator('#marcasChecks input[data-marca="Repsol"]').first();
  if (await m.count()) await m.check({ force: true }).catch(async () => m.click({ force: true }));
  await p.waitForTimeout(700);
  const d = await resumen(p);
  console.log('P4 marcas:', JSON.stringify(inv));
  chk('P4 marca Repsol', a, d);
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- P5: marcas ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo5-split-comparador');
  const a = await resumen(p);
  await p.locator('#fMarcas').click({ force: true });
  await p.waitForTimeout(500);
  const inv = await p.evaluate(() => {
    const pop = [...document.querySelectorAll('[role="dialog"], .popover, .marcas-pop, #popMarcas')].filter((e) => e.getBoundingClientRect().width > 30);
    return pop.map((e) => (e.id || e.className) + ' :: ' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 160));
  });
  const lbl = p.locator('label', { hasText: 'Repsol' }).first();
  if (await lbl.count()) await lbl.click({ force: true });
  await p.waitForTimeout(300);
  const aplicar = p.locator('button:has-text("Aplicar"), #marcasAplicar').first();
  if (await aplicar.count()) await aplicar.click({ force: true });
  await p.waitForTimeout(700);
  const d = await resumen(p);
  console.log('P5 popover marcas:', JSON.stringify(inv));
  chk('P5 marca Repsol', a, d);
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- P7: favoritos ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo7-asistente-decisiones', 390, 844);
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(700);
  const antes = await p.evaluate(() => ({
    favs: [...document.querySelectorAll('[data-fav]')].map((x) => (x.className.includes('on') ? '1' : '0')).join(''),
    chip: (document.body.innerText.match(/\d+\s*favoritas?/i) || [])[0] || '',
  }));
  await p.evaluate(() => {
    const b2 = [...document.querySelectorAll('[data-fav]')].find((x) => !x.className.includes('on'));
    if (b2) b2.click();
  });
  await p.waitForTimeout(600);
  const desp = await p.evaluate(() => ({
    favs: [...document.querySelectorAll('[data-fav]')].map((x) => (x.className.includes('on') ? '1' : '0')).join(''),
    chip: (document.body.innerText.match(/\d+\s*favoritas?/i) || [])[0] || '',
  }));
  console.log('P7 favoritos:', JSON.stringify(antes), '→', JSON.stringify(desp), antes.favs !== desp.favs ? 'ok' : 'FALLO');
  if (antes.favs === desp.favs) fallos++;
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- P8: favoritos ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  await p.locator('button:has-text("Estaciones")').first().click({ force: true });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const bFav = document.querySelector('#tablaEst button[data-fav], #tablaEst .fila-est button');
    return { hayBotonFav: !!bFav, txt: bFav?.textContent.trim(), attrs: bFav ? [...bFav.attributes].map((a) => a.name + '=' + a.value).join(',') : '' };
  });
  console.log('P8 favoritos en tabla:', JSON.stringify(r).slice(0, 300));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- Descuentos: P1 ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo1-mapa-hojas', 1440, 900);
  await p.locator('button[data-vista="config"]').first().click({ force: true });
  await p.waitForTimeout(700);
  const inv = await p.evaluate(() => ({
    inputs: document.querySelectorAll('[data-desc-valor]').length,
    ejemplo: [...document.querySelectorAll('[data-desc-valor]')].slice(0, 3).map((i) => i.getAttribute('data-desc-valor') + '=' + i.value),
  }));
  const inp = p.locator('[data-desc-valor="Repsol"]').first();
  const antes = await p.evaluate(() => [...document.querySelectorAll('.marcador, .precio')].slice(0, 4).map((e) => e.textContent.trim()));
  if (await inp.count()) {
    await inp.fill('0.10');
    await inp.dispatchEvent('input');
    await inp.dispatchEvent('change');
  }
  await p.waitForTimeout(700);
  const desp = await p.evaluate(() => [...document.querySelectorAll('.marcador, .precio')].slice(0, 4).map((e) => e.textContent.trim()));
  console.log('P1 descuentos:', JSON.stringify(inv), JSON.stringify(antes), '→', JSON.stringify(desp));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

/* ---------- Estados vacíos ---------- */
for (const [dir, accion] of [
  ['prototipo1-mapa-hojas', async (p) => { await p.locator('#buscador').fill('zzzz'); }],
  ['prototipo3-lista-tarjetas', async (p) => { await p.locator('#buscador').fill('zzzz'); }],
  ['prototipo5-split-comparador', async (p) => { await p.locator('#buscar').fill('zzzz'); }],
  ['prototipo8-panel-de-datos', async (p) => { await p.locator('button:has-text("Estaciones")').first().click({ force: true }); await p.waitForTimeout(500); await p.locator('#buscar').fill('zzzz'); }],
]) {
  const { ctx, p, errs } = await abrir(dir);
  try { await accion(p); } catch (e) { console.log(dir, 'EXC', e.message.split('\n')[0]); }
  await p.waitForTimeout(800);
  const d = await p.evaluate(() => ({
    vacio: document.body.innerText.match(/sin (resultados|estaciones|coincidencias)[^\n]{0,60}|no (hay|se han encontrado)[^\n]{0,60}|ninguna estaci[^\n]{0,60}/i)?.[0] || '',
    filas: document.querySelectorAll('[data-fila], [data-estacion], [data-id], tbody tr, .tarjeta').length,
  }));
  console.log('vacío', dir.split('-')[0], JSON.stringify(d));
  if (errs.length) console.log(' errs', errs);
  await ctx.close();
}

await b.close();
console.log('\nFALLOS:', fallos);
