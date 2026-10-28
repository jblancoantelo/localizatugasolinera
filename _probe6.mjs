import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

/* ---- P1 / P6: flujo real de la hoja de provincia ---- */
for (const dir of ['prototipo1-mapa-hojas', 'prototipo6-gestos-atajos']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  await p.locator('button:has-text("Provincia")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  await p.locator('#opcCuerpo .opcion', { hasText: 'Barcelona' }).first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.locator('#opcPie button:has-text("Ver estaciones")').first().click().catch(() => {});
  await p.waitForTimeout(900);
  const r = await p.evaluate(() => ({
    cab: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120),
    resultados: (document.body.innerText.match(/(\d+)\s+(RESULTADOS|resultados)/i) || [])[0] || '',
    lista: (document.querySelector('#listaTarjetas, #listaHoja, #listaScroll')?.innerText || '').replace(/\s+/g, ' ').slice(0, 140),
  }));
  console.log(dir, '→', JSON.stringify(r, null, 1));
  await ctx.close();
}

/* ---- P1: tooltip de canvas (diferencia de píxeles) ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  await p.goto(pathToFileURL(path.join(base, 'prototipo1-mapa-hojas', 'index.html')).href);
  await p.waitForTimeout(700);
  await p.locator('[data-shot="detalle"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  await p.locator('button:has-text("Histórico")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const canvas = p.locator('#histCanvas').first();
  const box = await canvas.boundingBox();
  const hash = () => p.evaluate(() => {
    const c = document.querySelector('#histCanvas');
    if (!c) return 'sin canvas';
    const ctx2 = c.getContext('2d');
    const d = ctx2.getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) % 2147483647;
    return h;
  });
  const antes = await hash();
  let despues = antes;
  if (box) {
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await p.waitForTimeout(200);
    await p.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.5);
    await p.waitForTimeout(300);
    despues = await hash();
  }
  console.log('P1 tooltip canvas: hash', antes, '→', despues, '| cambia:', antes !== despues);
  await ctx.close();
}

/* ---- P3: tooltip SVG (aparición de nodo) ---- */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  await p.goto(pathToFileURL(path.join(base, 'prototipo3-lista-tarjetas', 'index.html')).href);
  await p.waitForTimeout(700);
  await p.locator('[data-shot="detalle"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  await p.locator('button:has-text("Histórico")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const svg = p.locator('#detalleScroll svg, .detalle svg').last();
  const box = await svg.boundingBox().catch(() => null);
  const cuentas = () => p.evaluate(() => ({
    nodos: document.querySelectorAll('.tooltip, .grafica-tooltip, [class*="tip"]').length,
    textos: [...document.querySelectorAll('div, span')].filter((e) => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return cs.position !== 'static' && r.width > 20 && r.width < 240 && /\d,\d{3}/.test(e.textContent || '') && (e.textContent || '').length < 50;
    }).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3),
  }));
  const antes = await cuentas();
  if (box) {
    for (const f of [0.25, 0.4, 0.55, 0.7]) {
      await p.mouse.move(box.x + box.width * f, box.y + box.height * 0.5);
      await p.waitForTimeout(250);
    }
  }
  const despues = await cuentas();
  console.log('P3 tooltip svg:', JSON.stringify({ antes, despues, cambia: JSON.stringify(antes) !== JSON.stringify(despues) }));
  await ctx.close();
}

await b.close();
