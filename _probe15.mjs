import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

const MET = `(() => {
  const txt = (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 1000);
  const filas = document.querySelectorAll('[data-fila],[data-id],tbody tr,.tarjeta,.fila,.resultado,[data-estacion]').length;
  const precios = [...document.querySelectorAll('.precio, .tarjeta-precio b, .marcador, .valor')].slice(0, 6).map((e) => e.textContent.trim().slice(0, 10));
  return { filas, txt, precios: precios.join(',') };
})()`;

let fallos = 0;
async function paso(dir, nombre, fn, w = 1440, h = 900) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  const antes = await p.evaluate(MET);
  let nota = '';
  try { nota = (await fn(p)) || ''; } catch (e) { nota = 'EXC ' + e.message.split('\n')[0]; }
  await p.waitForTimeout(800);
  const desp = await p.evaluate(MET);
  const ok = antes.filas !== desp.filas || antes.txt !== desp.txt;
  if (!ok) fallos++;
  const id = dir.replace('prototipo', 'P').split('-')[0];
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${id.padEnd(3)} ${nombre.padEnd(32)} filas ${String(antes.filas).padStart(3)}→${String(desp.filas).padStart(3)} precios ${antes.precios.slice(0, 18)}→${desp.precios.slice(0, 18)}${nota ? ' | ' + nota : ''}`);
  if (errs.length) { console.log('        ERRS:', errs.slice(0, 2)); fallos++; }
  await ctx.close();
}

/* ============ P1 / P6: hoja genérica ============ */
async function hoja(p, chip, opcion, boton) {
  await p.locator(`[data-chip="${chip}"]`).first().click({ force: true });
  await p.waitForTimeout(450);
  const opc = p.locator(`#opcCuerpo [data-opcion="${opcion}"]`).first();
  if (!(await opc.count())) throw new Error('sin opción ' + opcion);
  await opc.click({ force: true });
  await p.waitForTimeout(250);
  await p.locator(`#opcPie button:has-text("${boton}")`).first().click({ force: true });
  return await p.evaluate((c) => document.querySelector(`[data-chip="${c}"]`)?.textContent.trim(), chip);
}
for (const dir of ['prototipo1-mapa-hojas', 'prototipo6-gestos-atajos']) {
  await paso(dir, 'combustible → Gasóleo A', (p) => hoja(p, 'fuel', 'Gasóleo A', 'Aplicar'), 390, 844);
  await paso(dir, 'localidad → Getafe', (p) => hoja(p, 'loc', 'Getafe', 'Aplicar'), 390, 844);
  await paso(dir, 'marca → Repsol', (p) => hoja(p, 'marcas', 'Repsol', 'Ver resultados'), 390, 844);
  await paso(dir, 'orden → precio desc', (p) => hoja(p, 'orden', 'precio-desc', 'Aplicar'), 390, 844);
  await paso(dir, 'distancia → 10 km', async (p) => {
    await p.locator('[data-chip="dist"]').first().click({ force: true });
    await p.waitForTimeout(450);
    await p.evaluate(() => { const r = document.querySelector('#opcCuerpo input[type="range"]'); r.value = 10; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.locator('#opcPie button:has-text("Aplicar")').first().click({ force: true });
    return await p.evaluate(() => document.querySelector('[data-chip="dist"]')?.textContent.trim());
  }, 390, 844);
}

/* ============ P3: hoja de filtros real ============ */
async function p3Filtros(p, cfg) {
  await p.locator('[data-accion="filtros"]').first().click({ force: true });
  await p.waitForTimeout(600);
  if (!(await p.locator('#capaFiltros:not([hidden])').count())) throw new Error('hoja no abierta');
  if (cfg.fuel) await p.selectOption('#fCombustible', { label: cfg.fuel });
  if (cfg.loc) await p.selectOption('#fLocalidad', { label: cfg.loc });
  if (cfg.prov) await p.selectOption('#fProvincia', { label: cfg.prov });
  if (cfg.marca) {
    const lbl = p.locator('#fMarcas label', { hasText: cfg.marca }).first();
    await lbl.click({ force: true });
  }
  if (cfg.dist) await p.evaluate((v) => { const r = document.querySelector('#fDistancia'); r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); }, cfg.dist);
  if (cfg.fav) await p.locator('#fSoloFav').check({ force: true }).catch(() => {});
  await p.waitForTimeout(300);
  const etiqueta = await p.locator('#fAplicar').innerText();
  await p.locator('#fAplicar').click({ force: true });
  return etiqueta;
}
await paso('prototipo3-lista-tarjetas', 'filtros: Gasóleo A', (p) => p3Filtros(p, { fuel: 'Gasóleo A' }));
await paso('prototipo3-lista-tarjetas', 'filtros: Getafe', (p) => p3Filtros(p, { loc: 'Getafe' }));
await paso('prototipo3-lista-tarjetas', 'filtros: marca Repsol', (p) => p3Filtros(p, { marca: 'Repsol' }));
await paso('prototipo3-lista-tarjetas', 'filtros: 5 km', (p) => p3Filtros(p, { dist: 5 }));
await paso('prototipo3-lista-tarjetas', 'filtros: solo favoritas', (p) => p3Filtros(p, { fav: true }));
await paso('prototipo3-lista-tarjetas', 'filtros: Barcelona', (p) => p3Filtros(p, { prov: 'Barcelona' }));

/* ============ P2: selects + hoja de filtros ============ */
await paso('prototipo2-escritorio-sala-de-control', 'buscador Repsol', async (p) => {
  await p.locator('#buscador, input[type="text"]').first().fill('Repsol');
  return 'fill';
});
await paso('prototipo2-escritorio-sala-de-control', 'orden → más caras', async (p) => {
  await p.selectOption('#ordenLista', { label: 'Más caras' });
  return 'ordenLista';
});
await paso('prototipo2-escritorio-sala-de-control', 'orden → más cercanas', async (p) => {
  await p.selectOption('#ordenLista', { label: 'Más cercanas' });
  return 'ordenLista';
});
await paso('prototipo2-escritorio-sala-de-control', 'hoja filtros', async (p) => {
  await p.locator('[data-desplegable="filtros"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const d = await p.evaluate(() => {
    const cont = [...document.querySelectorAll('[role="dialog"], .desp, .desplegable')].filter((e) => e.getBoundingClientRect().width > 40);
    return cont.map((e) => (e.id || e.className) + ' :: ' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 240));
  });
  return JSON.stringify(d).slice(0, 300);
});

/* ============ P4 ============ */
await paso('prototipo4-modo-noche-conduccion', 'localidad Getafe', async (p) => { await p.selectOption('#selLocalidad', { label: 'Getafe' }); return 'selLocalidad'; });
await paso('prototipo4-modo-noche-conduccion', 'combustible Gasóleo A', async (p) => { await p.selectOption('#selCombustible', { label: 'Gasóleo A' }); return 'selCombustible'; });
await paso('prototipo4-modo-noche-conduccion', 'orden distancia', async (p) => { await p.selectOption('#selOrden', { label: 'Distancia' }); return 'selOrden'; });
await paso('prototipo4-modo-noche-conduccion', 'búsqueda Repsol', async (p) => { await p.locator('#inpBusqueda').fill('Repsol'); return 'inpBusqueda'; });
await paso('prototipo4-modo-noche-conduccion', 'favoritas', async (p) => {
  const el = p.locator('button:has-text("Favoritas"), .chip:has-text("Favoritas")').first();
  if (!(await el.count())) throw new Error('sin control favoritas');
  await el.click({ force: true });
  return 'fav';
});

/* ============ P5 ============ */
await paso('prototipo5-split-comparador', 'localidad Getafe', async (p) => { await p.selectOption('#fLocalidad', { label: 'Getafe' }); return 'fLocalidad'; });
await paso('prototipo5-split-comparador', 'combustible Gasóleo A', async (p) => { await p.selectOption('#fCombustible', { label: 'Gasóleo A' }); return 'fCombustible'; });
await paso('prototipo5-split-comparador', 'orden precio desc', async (p) => { await p.selectOption('#ordenSel', { label: 'Precio ↓' }); return 'ordenSel'; });
await paso('prototipo5-split-comparador', 'búsqueda Repsol', async (p) => { await p.locator('#buscar').fill('Repsol'); return 'buscar'; });
await paso('prototipo5-split-comparador', 'tamaño de página 15', async (p) => { await p.selectOption('#pageSizeSel', { label: '15' }); return 'pageSize'; });
await paso('prototipo5-split-comparador', 'distancia 10 km', async (p) => {
  await p.locator('#fDistancia, input[type="number"]').first().fill('10');
  await p.locator('#fDistancia, input[type="number"]').first().dispatchEvent('change');
  return 'fDistancia';
});
await paso('prototipo5-split-comparador', 'comparador: marcar 2', async (p) => {
  const chks = p.locator('input#check-comparar, input[type="checkbox"]');
  const n = await chks.count();
  if (n < 2) throw new Error('menos de 2 checkboxes (' + n + ')');
  await chks.nth(0).check({ force: true });
  await chks.nth(1).check({ force: true });
  await p.waitForTimeout(500);
  return 'checks=' + n;
});

/* ============ P8 ============ */
await paso('prototipo8-panel-de-datos', 'combustible Gasóleo A', async (p) => { await p.selectOption('#selFuel', { label: 'Gasóleo A' }); return 'selFuel'; });
await paso('prototipo8-panel-de-datos', 'días 30', async (p) => { await p.selectOption('#selDias', { label: '30 días' }); return 'selDias'; });
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(path.join(base, 'prototipo8-panel-de-datos', 'index.html')).href);
  await p.waitForTimeout(800);
  for (const v of ['estaciones', 'mapa']) {
    const btn = p.locator(`button[data-vista="${v}"], [data-destino="${v}"]`).first();
    if (await btn.count()) { await btn.click({ force: true }).catch(() => {}); await p.waitForTimeout(700); }
    const d = await p.evaluate(() => ({
      selects: [...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 20).map((s) => s.id + ':' + s.options.length),
      inputs: [...document.querySelectorAll('input')].filter((i) => i.getBoundingClientRect().width > 20).map((i) => i.type + ':' + (i.id || i.placeholder)),
      botones: [...document.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().width > 20).map((x) => (x.textContent || '').trim().slice(0, 18)).filter(Boolean).slice(0, 16),
    }));
    console.log('P8 vista', v, JSON.stringify(d).slice(0, 420));
  }
  await ctx.close();
}

await b.close();
console.log('\nFALLOS:', fallos);
