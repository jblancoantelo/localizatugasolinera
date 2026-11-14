import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

const MET = (zona) => `(() => {
  const e = ${zona ? `document.querySelector(${JSON.stringify(zona)})` : 'null'};
  const txt = e ? (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 1200) : (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 1200);
  const filas = document.querySelectorAll('[data-fila],[data-id],tbody tr,.tarjeta,.fila,.resultado,[data-estacion]').length;
  return { filas, txt };
})()`;

async function nueva(dir, w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  return { ctx, p, errs };
}

let fallos = 0;
async function paso(dir, nombre, fn, { zona, w = 390, h = 844 } = {}) {
  const { ctx, p, errs } = await nueva(dir, w, h);
  const antes = await p.evaluate(MET(zona));
  let nota = '';
  try { nota = (await fn(p)) || ''; } catch (e) { nota = 'EXC ' + e.message.split('\n')[0]; }
  await p.waitForTimeout(800);
  const desp = await p.evaluate(MET(zona));
  const ok = antes.filas !== desp.filas || antes.txt !== desp.txt;
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLO'} ${dir.replace('prototipo', 'P').split('-')[0].padEnd(3)} ${nombre.padEnd(30)} filas ${String(antes.filas).padStart(3)}→${String(desp.filas).padStart(3)}${nota ? ' | ' + nota : ''}`);
  if (!ok) console.log('        antes :', antes.txt.slice(0, 110), '\n        despues:', desp.txt.slice(0, 110));
  if (errs.length) { console.log('        ERRS:', errs.slice(0, 2)); fallos++; }
  await ctx.close();
}

/* ---------- chip + hoja #opcCuerpo (P1 y P6) ---------- */
async function hoja(p, chip, valor, aplicar = 'Ver estaciones') {
  await p.locator(`[data-chip="${chip}"]`).first().click({ force: true });
  await p.waitForTimeout(450);
  const opc = p.locator('#opcCuerpo .opcion', { hasText: valor }).first();
  const n = await opc.count();
  if (!n) throw new Error('sin opción ' + valor);
  await opc.click({ force: true });
  await p.waitForTimeout(250);
  if (aplicar) await p.locator(`#opcPie button:has-text("${aplicar}")`).first().click({ force: true });
  return 'opciones ok';
}

for (const dir of ['prototipo1-mapa-hojas', 'prototipo6-gestos-atajos']) {
  await paso(dir, 'buscador Repsol', async (p) => {
    const inp = p.locator('#buscador').first();
    if (!(await inp.count())) throw new Error('sin #buscador');
    await inp.fill('Repsol');
    return 'fill';
  });
  await paso(dir, 'combustible Gasóleo A', async (p) => {
    await hoja(p, 'fuel', 'Gasóleo A');
    return await p.evaluate(() => document.querySelector('[data-chip="fuel"]')?.textContent.trim());
  });
  await paso(dir, 'localidad Getafe', async (p) => {
    await hoja(p, 'loc', 'Getafe');
    return await p.evaluate(() => document.querySelector('[data-chip="loc"]')?.textContent.trim());
  });
  await paso(dir, 'marca Repsol', async (p) => {
    await hoja(p, 'marcas', 'Repsol');
    return await p.evaluate(() => document.querySelector('[data-chip="marcas"]')?.textContent.trim());
  });
  await paso(dir, 'orden Precio ↓', async (p) => {
    await hoja(p, 'orden', 'Precio ↓');
    return await p.evaluate(() => document.querySelector('[data-chip="orden"]')?.textContent.trim());
  });
  await paso(dir, 'solo favoritas', async (p) => {
    await p.locator('[data-chip="fav"]').first().click({ force: true });
    return await p.evaluate(() => document.querySelector('[data-chip="fav"]')?.className);
  });
  await paso(dir, 'distancia', async (p) => {
    await p.locator('[data-chip="dist"]').first().click({ force: true });
    await p.waitForTimeout(450);
    const slider = p.locator('#opcCuerpo input[type="range"]').first();
    if (!(await slider.count())) throw new Error('sin slider');
    await slider.evaluate((el) => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.locator('#opcPie button').last().click({ force: true });
    return await p.evaluate(() => document.querySelector('[data-chip="dist"]')?.textContent.trim());
  });
}

/* ---------- P6: búsqueda con la tecla / ---------- */
await paso('prototipo6-gestos-atajos', 'buscar con /', async (p) => {
  await p.keyboard.press('/');
  await p.waitForTimeout(400);
  const inp = p.locator('input:visible').first();
  const hay = await inp.count();
  if (!hay) throw new Error('no aparece input');
  await inp.fill('Repsol');
  await p.keyboard.press('Enter');
  return 'input ' + (await inp.getAttribute('id'));
});

/* ---------- P3 ---------- */
await paso('prototipo3-lista-tarjetas', 'buscador Repsol', async (p) => {
  await p.locator('#buscador').first().fill('Repsol');
  return 'fill';
});
await paso('prototipo3-lista-tarjetas', 'orden Precio ↓', async (p) => {
  await p.locator('[data-orden="precio-desc"]').first().click({ force: true });
  return 'precio-desc';
});
await paso('prototipo3-lista-tarjetas', 'favoritas', async (p) => {
  await p.locator('[data-accion="favoritas"]').first().click({ force: true });
  return 'fav';
});
await paso('prototipo3-lista-tarjetas', 'solo abiertas 24 h', async (p) => {
  await p.locator('[data-accion="24h"]').first().click({ force: true });
  return '24h';
});
await paso('prototipo3-lista-tarjetas', 'hoja filtros (marca Repsol + Ver)', async (p) => {
  await p.locator('[data-accion="filtros"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const marcas = await p.evaluate(() => [...document.querySelectorAll('#fMarcas input, #hojaFiltros input[type="checkbox"]')].map((i) => (i.value || i.parentElement.textContent.trim()).slice(0, 20)));
  const chk = p.locator('#hojaFiltros input[type="checkbox"]').first();
  if (await chk.count()) await chk.check({ force: true }).catch(() => chk.click({ force: true }));
  await p.locator('#fAplicar').first().click({ force: true });
  return 'marcas=' + JSON.stringify(marcas.slice(0, 4));
});
await paso('prototipo3-lista-tarjetas', 'hoja combustible', async (p) => {
  await p.locator('[data-accion="combustible"]').first().click({ force: true });
  await p.waitForTimeout(500);
  const opc = p.locator('#hojaFiltros [data-fuel], #hojaFiltros button', { hasText: 'Gasóleo A' }).first();
  if (!(await opc.count())) throw new Error('sin opción Gasóleo A');
  await opc.click({ force: true });
  await p.locator('#fAplicar').first().click({ force: true });
  return 'gasóleo A';
});

/* ---------- P7: explorar ---------- */
{
  const { ctx, p } = await nueva('prototipo7-asistente-decisiones');
  await p.locator('button[data-vista="explorar"]').first().click({ force: true });
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => ({
    selects: [...document.querySelectorAll('#vista-explorar select, [data-vista="explorar"] select')].map((s) => s.id + ':' + [...s.options].map((o) => o.textContent.trim()).slice(0, 4).join('/')),
    inputs: [...document.querySelectorAll('#vista-explorar input, [data-vista="explorar"] input')].map((i) => i.type + ':' + (i.id || i.placeholder)),
    botones: [...document.querySelectorAll('[data-vista="explorar"] button, #vista-explorar button')].map((x) => (x.textContent || '').trim().slice(0, 24)).filter(Boolean).slice(0, 20),
  }));
  console.log('P7 explorar:', JSON.stringify(info));
  await ctx.close();
}

await b.close();
console.log('\nFALLOS:', fallos);
