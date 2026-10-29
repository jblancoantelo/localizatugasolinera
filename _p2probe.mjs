import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const file = pathToFileURL(path.resolve('prototipos_opencode_bigpickle/prototipo2-escritorio-sala-de-control/index.html')).href;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(file);
await p.waitForTimeout(600);

const out = await p.evaluate(() => {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g).map(Number).slice(0, 3);
    const [r, g, b] = m.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2);
  };
  const el = document.querySelector('.precio-dto');
  if (!el) return { error: 'no .precio-dto' };
  const cs = getComputedStyle(el);
  const parentBg = getComputedStyle(el.parentElement).backgroundColor;
  const root = getComputedStyle(document.documentElement);
  return {
    texto: cs.color,
    fondo: cs.backgroundColor,
    padreFondo: parentBg,
    ratioPropio: ratio(cs.color, cs.backgroundColor),
    ratioPadre: ratio(cs.color, parentBg),
    tokenVerde: root.getPropertyValue('--verde').trim(),
  };
});
console.log(JSON.stringify(out, null, 2));
await b.close();
