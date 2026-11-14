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
  p.setDefaultTimeout(3000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);

  await p.locator('[data-shot="detalle"]:visible, [data-accion="abrir-detalle"]:visible').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(800);
  const tabh = p.locator('button:has-text("Histórico"):visible').first();
  if (await tabh.count()) { await tabh.click({ force: true }).catch(() => {}); await p.waitForTimeout(700); }

  /* candidatos a gráfica: canvas visible o el SVG más grande */
  const box = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 120 && r.height > 60 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const cs = [...document.querySelectorAll('canvas')].filter(vis);
    if (cs.length) { const r = cs[cs.length - 1].getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, tipo: 'canvas' }; }
    const svs = [...document.querySelectorAll('svg')].filter(vis).sort((a, c) => c.getBoundingClientRect().width - a.getBoundingClientRect().width);
    if (svs.length) { const r = svs[0].getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, tipo: 'svg' }; }
    return null;
  });

  const leer = () => p.evaluate(() => {
    const out = [];
    document.querySelectorAll('[id*="tooltip" i], [class*="tooltip" i], [id*="tip" i], [class*="tip" i]').forEach((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (r.width > 10 && cs.visibility !== 'hidden' && cs.display !== 'none' && txt) out.push(txt.slice(0, 60));
    });
    if (!out.length) {
      document.querySelectorAll('div, span').forEach((e) => {
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
        if (cs.position !== 'static' && r.width > 20 && r.width < 260 && txt.length < 60 &&
          /\d,\d{3}/.test(txt) && /\d{2}[-/]\d{2}/.test(txt)) out.push(txt);
      });
    }
    return [...new Set(out)].slice(0, 3);
  });

  const antes = await leer();
  let tips = [];
  if (box) {
    await p.mouse.move(box.x + 6, box.y + box.h / 2);
    for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
      await p.mouse.move(box.x + box.w * f, box.y + box.h * (0.35 + (f % 0.3)));
      await p.waitForTimeout(180);
      const t = await leer();
      if (t.length) tips.push(...t);
    }
  }
  const unicos = [...new Set(tips)].filter((t) => !antes.includes(t));
  console.log(dir.replace('prototipo', 'P').padEnd(36), 'grafica=' + (box ? box.tipo : 'sin'), '| tooltip:', unicos.length ? JSON.stringify(unicos.slice(0, 2)) : 'NO', errs.length ? '| errs: ' + errs[0] : '');
  await ctx.close();
}
await b.close();
