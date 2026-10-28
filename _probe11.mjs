import { chromium } from 'playwright';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const dirs = (await readdir(base, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^prototipo/i.test(d.name)).map((d) => d.name).sort();

const b = await chromium.launch();
for (const dir of dirs) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  const info = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const selects = [...document.querySelectorAll('select')].filter(vis).map((s) => (s.id || s.className) + ' {' + [...s.options].map((o) => o.textContent.trim()).join(' / ').slice(0, 130) + '}');
    const inputs = [...document.querySelectorAll('input')].filter(vis).map((i) => (i.type || 'text') + ':' + (i.id || i.className || i.placeholder || '?'));
    const chips = [...document.querySelectorAll('[data-filtro], [data-hoja], [data-accion="desplegable"], [data-seccion]')].filter(vis)
      .map((e) => (e.tagName.toLowerCase()) + '[' + [...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name + '=' + a.value).join(',') + ']=' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 26));
    const filas = document.querySelectorAll('[data-fila], [data-id], tbody tr, .tarjeta, .fila, .resultado').length;
    return { selects, inputs, chips: chips.slice(0, 30), filas };
  });
  console.log('\n###### ' + dir);
  console.log(' filas=' + info.filas);
  console.log(' selects:', info.selects.length ? info.selects.join('\n          ') : '-');
  console.log(' inputs :', info.inputs.join(' | ') || '-');
  console.log(' chips  :', info.chips.join(' | ') || '-');
  await ctx.close();
}
await b.close();
