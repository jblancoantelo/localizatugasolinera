import { chromium } from 'playwright';
import { readdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const dirs = (await readdir(base, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^prototipo/i.test(d.name))
  .map((d) => d.name)
  .sort();

const b = await chromium.launch();
const res = {};
for (const d of dirs) {
  const html = path.join(base, d, 'index.html');
  if (!fs.existsSync(html)) continue;
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(pathToFileURL(html).href);
  await p.waitForTimeout(700);
  res[d] = await p.evaluate(() => {
    const uniq = (arr) => [...new Set(arr)].sort();
    const acciones = uniq([...document.querySelectorAll('[data-accion]')].map((e) => e.dataset.accion));
    const vistas = uniq([...document.querySelectorAll('[data-vista]')].map((e) => e.dataset.vista));
    const tabs = uniq([...document.querySelectorAll('[role="tab"]')].map((e) => e.dataset.tab || e.dataset.vista || e.textContent.trim().slice(0, 20)));
    const selects = [...document.querySelectorAll('select')].map((s) => ({ id: s.id, opts: s.options.length, label: (s.closest('label')?.textContent || s.getAttribute('aria-label') || '').trim().slice(0, 30) }));
    const inputs = [...document.querySelectorAll('input')].map((i) => ({ id: i.id, type: i.type, ph: i.placeholder.slice(0, 30) }));
    const canvases = [...document.querySelectorAll('canvas')].map((c) => c.id || c.className);
    const panels = uniq([...document.querySelectorAll('[data-panel], [data-iapanel], [data-panelconfig]')].map((e) => e.dataset.panel || e.dataset.iapanel || e.dataset.panelconfig));
    const ids = uniq([...document.querySelectorAll('[id]')].map((e) => e.id)).slice(0, 400);
    return {
      titulo: document.title,
      acciones, vistas, tabs, selects, inputs, canvases, panels,
      ids,
      botones: [...document.querySelectorAll('button')].length,
      textoLargo: document.body.innerText.length,
    };
  });
  res[d].errores = errs;
  await ctx.close();
}
await b.close();
fs.writeFileSync('_dump.json', JSON.stringify(res, null, 2));
for (const [k, v] of Object.entries(res)) {
  console.log('\n### ' + k);
  console.log('  titulo:', v.titulo);
  console.log('  acciones:', v.acciones.join(', '));
  console.log('  vistas:', v.vistas.join(', '));
  console.log('  tabs:', v.tabs.join(' | '));
  console.log('  selects:', v.selects.map((s) => `${s.id || '?'}(${s.opts})`).join(', '));
  console.log('  inputs:', v.inputs.map((i) => `${i.type}:${i.id || '?'}`).join(', '));
  console.log('  canvas:', v.canvases.join(', '));
  console.log('  paneles:', v.panels.join(', '));
  console.log('  botones:', v.botones, '| errores:', v.errores.length ? v.errores.slice(0, 3) : 'ninguno');
}
