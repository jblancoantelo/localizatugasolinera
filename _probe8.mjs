import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

/* P2: #grTooltip dentro de #graficaCaja */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  await p.goto(pathToFileURL(path.join(base, 'prototipo2-escritorio-sala-de-control', 'index.html')).href);
  await p.waitForTimeout(700);
  await p.locator('[data-accion="abrir-detalle"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(700);
  await p.locator('button:has-text("Histórico")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const caja = await p.locator('#graficaCaja').boundingBox();
  let tips = [];
  if (caja) {
    for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      await p.mouse.move(caja.x + caja.width * f, caja.y + caja.height * 0.45);
      await p.waitForTimeout(200);
      const t = await p.evaluate(() => {
        const e = document.querySelector('#grTooltip');
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return r.width > 5 ? e.textContent.replace(/\s+/g, ' ').trim() : null;
      });
      if (t) tips.push(t);
    }
  }
  console.log('P2 tooltip:', JSON.stringify([...new Set(tips)]), '| caja:', !!caja);
  await ctx.close();
}

/* P5: tooltip pintado en #detGrafica (diferencia de píxeles) */
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  await p.goto(pathToFileURL(path.join(base, 'prototipo5-split-comparador', 'index.html')).href);
  await p.waitForTimeout(700);
  await p.locator('[data-shot="detalle"]').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const canvas = p.locator('#detGrafica').first();
  const caja = await canvas.boundingBox();
  const hash = () => p.evaluate(() => {
    const c = document.querySelector('#detGrafica');
    if (!c) return 'sin canvas';
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 61) h = (h * 33 + d[i]) % 2147483647;
    return h;
  });
  const antes = await hash();
  let aft = antes;
  let cambia = false;
  if (caja) {
    for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      await p.mouse.move(caja.x + caja.width * f, caja.y + caja.height * 0.45);
      await p.waitForTimeout(200);
    }
    aft = await hash();
    cambia = antes !== aft;
  }
  console.log('P5 tooltip canvas:', antes, '→', aft, '| cambia:', cambia, '| caja:', !!caja);
  await ctx.close();
}
await b.close();
