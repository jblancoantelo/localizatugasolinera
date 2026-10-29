import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.setDefaultTimeout(3000);
await p.goto(pathToFileURL(path.resolve('prototipos_opencode_bigpickle/prototipo5-split-comparador/index.html')).href);
await p.waitForTimeout(800);

console.log('disparadores:', await p.evaluate(() => document.querySelectorAll('[data-shot="detalle"]').length));
const trig = p.locator('[data-shot="detalle"]').first();
console.log('visible:', await trig.evaluate((el) => { const r = el.getBoundingClientRect(); return r.width + 'x' + r.height; }));
await trig.click({ force: true }).catch((e) => console.log('clic err', e.message.split('\n')[0]));
await p.waitForTimeout(900);
console.log(await p.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const pd = document.querySelector('#panelDetalle');
  const c = document.querySelector('#detGrafica');
  return {
    panelVisible: pd ? vis(pd) : null,
    panelTxt: pd ? pd.innerText.replace(/\s+/g, ' ').slice(0, 160) : null,
    canvasExiste: !!c,
    canvasBox: c ? (() => { const r = c.getBoundingClientRect(); return r.width + 'x' + r.height; })() : null,
    selects: [...document.querySelectorAll('#panelDetalle select')].map((s) => s.id + ':' + s.options.length),
  };
}));

/* pestaña Histórico del panel de detalle */
const tabh = p.locator('#panelDetalle button:has-text("Histórico")').first();
if (await tabh.count()) { await tabh.click({ force: true }).catch(() => {}); await p.waitForTimeout(900); }
console.log('tras clic en fila:', await p.evaluate(() => {
  const c = document.querySelector('#detGrafica');
  const r = c ? c.getBoundingClientRect() : null;
  return { existe: !!c, box: r ? r.width + 'x' + r.height : null, canvas: [...document.querySelectorAll('canvas')].map((x) => { const q = x.getBoundingClientRect(); return x.id + ':' + q.width + 'x' + q.height; }) };
}));

const caja = await p.locator('#detGrafica').boundingBox();
console.log('boundingBox:', caja);
if (caja) {
  const hash = () => p.evaluate(() => {
    const c = document.querySelector('#detGrafica');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 61) h = (h * 33 + d[i]) % 2147483647;
    return h;
  });
  const antes = await hash();
  for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    await p.mouse.move(caja.x + caja.width * f, caja.y + caja.height * 0.45);
    await p.waitForTimeout(220);
  }
  const despues = await hash();
  console.log('hash', antes, '→', despues, '| tooltip pinta:', antes !== despues);
}
await b.close();
