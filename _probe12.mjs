import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();
for (const dir of ['prototipo1-mapa-hojas', 'prototipo3-lista-tarjetas', 'prototipo6-gestos-atajos', 'prototipo7-asistente-decisiones']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  const info = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
    const btn = [...document.querySelectorAll('button, [role="button"], .chip, .ficha-opcion')].filter(vis)
      .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) + ' #' + (e.id || '-') + ' .' + (e.className || '-').toString().slice(0, 30) + ' ' + [...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value).join(','));
    const vistas = [...document.querySelectorAll('[data-vista]')].map((e) => e.tagName + ':' + e.getAttribute('data-vista'));
    return { btn, vistas };
  });
  console.log('\n##### ' + dir + '  vistas=' + JSON.stringify(info.vistas));
  info.btn.slice(0, 40).forEach((t) => console.log('   ' + t));
  await ctx.close();
}
await b.close();
