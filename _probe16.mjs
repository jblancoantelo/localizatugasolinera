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
  await p.waitForTimeout(750);
  return { ctx, p, errs };
};
const med = (p) => p.evaluate(() => ({
  tr: document.querySelectorAll('tbody tr').length,
  tarjetas: document.querySelectorAll('.tarjeta, [data-estacion], .fila').length,
  pag: (document.body.innerText.match(/p[áa]gina\s*\d+\s*de\s*\d+|\d+\s*\/\s*\d+/i) || [])[0] || '',
  txt: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  precios: [...document.querySelectorAll('.precio, .tarjeta-precio b, .marcador')].slice(0, 5).map((e) => e.textContent.trim()).join(','),
}));

/* ---------- P1: marca y distancia (tras el fix) ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo1-mapa-hojas', 390, 844);
  for (const [chip, opc, boton, campo] of [['marcas', 'Repsol', 'Ver resultados', 'marcas'], ['dist', null, 'Aplicar', 'dist']]) {
    await p.locator(`[data-chip="${chip}"]`).first().click({ force: true });
    await p.waitForTimeout(450);
    if (opc) {
      await p.locator(`#opcCuerpo [data-opcion="${opc}"]`).first().click({ force: true });
    } else {
      await p.evaluate(() => { const r = document.querySelector('#opcCuerpo input[type="range"]'); r.value = 12; r.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    await p.waitForTimeout(250);
    await p.locator(`#opcPie button:has-text("${boton}")`).first().click({ force: true });
    await p.waitForTimeout(700);
    const r = await p.evaluate((c) => ({ chip: document.querySelector(`[data-chip="${c}"]`)?.textContent.trim(), filas: document.querySelectorAll('[data-estacion]').length, txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 150) }), chip);
    console.log('P1', campo, '→', JSON.stringify(r));
  }
  if (errs.length) console.log('P1 errs', errs);
  await ctx.close();
}

/* ---------- P3: solo favoritas desde el switch ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo3-lista-tarjetas');
  const antes = await med(p);
  await p.locator('[data-accion="filtros"]').first().click({ force: true });
  await p.waitForTimeout(500);
  await p.locator('.switch-fila').first().click({ force: true });
  const marcado = await p.evaluate(() => document.querySelector('#fSoloFav')?.checked);
  await p.locator('#fAplicar').click({ force: true });
  await p.waitForTimeout(700);
  const desp = await med(p);
  console.log('P3 solo favoritas → marcado=' + marcado + ' | filas', antes.tarjetas, '→', desp.tarjetas, '|', desp.txt.slice(0, 90));
  if (errs.length) console.log('P3 errs', errs);
  await ctx.close();
}

/* ---------- P4: favoritas (label del switch) ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo4-modo-noche-conduccion');
  const antes = await med(p);
  const lbl = p.locator('label:has(#chkFavoritos)').first();
  if (await lbl.count()) await lbl.click({ force: true });
  await p.waitForTimeout(700);
  const desp = await med(p);
  console.log('P4 favoritas →', antes.tarjetas, '→', desp.tarjetas, '| checked', await p.evaluate(() => document.querySelector('#chkFavoritos')?.checked), '|', desp.txt.slice(0, 90));
  if (errs.length) console.log('P4 errs', errs);
  await ctx.close();
}

/* ---------- P5: pageSize y comparador ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo5-split-comparador');
  const antes = await med(p);
  await p.selectOption('#pageSizeSel', '15');
  await p.waitForTimeout(700);
  const con15 = await med(p);
  console.log('P5 pageSize 15 →', JSON.stringify({ antes: antes.tr, despues: con15.tr, pag: con15.pag }));

  const chks = p.locator('.check-comparar');
  const n = await chks.count();
  await chks.nth(0).check({ force: true });
  await chks.nth(1).check({ force: true });
  await p.waitForTimeout(600);
  const barra = await p.evaluate(() => {
    const bar = document.querySelector('#barraComparar');
    return { existe: !!bar, oculta: bar?.hidden, texto: (bar?.innerText || '').replace(/\s+/g, ' ').slice(0, 120), marcas: document.querySelectorAll('.check-comparar:checked').length };
  });
  console.log('P5 comparador → checks=' + n + ' |', JSON.stringify(barra));
  if (errs.length) console.log('P5 errs', errs);
  await ctx.close();
}

/* ---------- P8: días (canvas del panel) ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo8-panel-de-datos');
  const hash = () => p.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')].filter((c) => c.getBoundingClientRect().width > 60);
    let h = 0;
    cs.forEach((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 137) h = (h * 31 + d[i]) % 2147483647; });
    return { h, n: cs.length };
  });
  const antes = await hash();
  await p.selectOption('#selDias', '30 días');
  await p.waitForTimeout(900);
  const desp = await hash();
  const txt = await p.evaluate(() => (document.body.innerText.match(/\d+\s*d[íi]as/g) || []).slice(0, 4));
  console.log('P8 días 30 → canvas', JSON.stringify(antes), '→', JSON.stringify(desp), '| textos', JSON.stringify(txt));
  if (errs.length) console.log('P8 errs', errs);
  await ctx.close();
}

/* ---------- P2: aplicar localidad en la hoja de filtros ---------- */
{
  const { ctx, p, errs } = await abrir('prototipo2-escritorio-sala-de-control');
  const antes = await p.evaluate(() => [...document.querySelectorAll('[data-fila]')].length);
  await p.locator('[data-desplegable="filtros"]').first().click({ force: true });
  await p.waitForTimeout(600);
  const opc = p.locator('[role="option"]:has-text("Getafe"), .desp-opcion:has-text("Getafe"), .opcion:has-text("Getafe")').first();
  const n = await opc.count();
  if (n) await opc.click({ force: true });
  await p.waitForTimeout(800);
  const desp = await p.evaluate(() => ({ filas: document.querySelectorAll('[data-fila]').length, chip: document.querySelector('[data-desplegable="filtros"]')?.textContent.replace(/\s+/g, ' ').trim(), txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 130) }));
  console.log('P2 filtros localidad → opciones=' + n + ' | filas', antes, '→', desp.filas, '|', desp.chip);
  if (errs.length) console.log('P2 errs', errs);
  await ctx.close();
}

await b.close();
