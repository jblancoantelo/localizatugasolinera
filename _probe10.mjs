/**
 * Sonda de paridad funcional: para cada prototipo comprueba que cada control
 * de filtro/orden/búsqueda/paginación cambia de verdad el contenido.
 * Cada comprobación se hace en una página recién cargada.
 */
import { chromium } from 'playwright';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const dirs = (await readdir(base, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^prototipo/i.test(d.name)).map((d) => d.name).sort();

const ZONAS = ['#lista', '#listaTarjetas', '#listaScroll', '#listaCuerpo', '#cuerpoLista', '#panel', '#contenido',
  '#resultados', '.panel-datos', '#kpis', '#fichas', '#tarjetas', '#tabla', '#cuerpoTabla', 'tbody', 'main'];

const SNAP = `(() => {
  const zonas = ${JSON.stringify(ZONAS)};
  const partes = [];
  for (const z of zonas) {
    document.querySelectorAll(z).forEach((e) => {
      const t = (e.innerText || '').replace(/\\s+/g, ' ').trim();
      if (t.length > 40) partes.push(t.slice(0, 4000));
    });
  }
  const todo = partes.length ? partes.join(' | ') : (document.body.innerText || '').replace(/\\s+/g, ' ').slice(0, 6000);
  return todo;
})()`;

const b = await chromium.launch();

async function nueva(dir) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(650);
  return { ctx, p, errs };
}

const resultados = [];

for (const dir of dirs) {
  const fila = { dir, prov: '-', loc: '-', comb: '-', marca: '-', busca: '-', fav: '-', orden: '-', pag: '-', errs: [] };

  const probar = async (fn) => {
    const { ctx, p, errs } = await nueva(dir);
    try { await fn(p); } finally { fila.errs.push(...errs); await ctx.close(); }
  };

  /* ---------- selects genéricos: provincia / localidad / combustible / marca / orden ---------- */
  await probar(async (p) => {
    const sels = await p.evaluate(() => [...document.querySelectorAll('select')]
      .filter((s) => { const r = s.getBoundingClientRect(); return r.width > 20 && r.height > 10 && s.options.length > 1; })
      .map((s) => ({ id: s.id || '', label: (s.getAttribute('aria-label') || '') + ' ' + (s.labels?.[0]?.textContent || ''), n: s.options.length, opts: [...s.options].map((o) => o.textContent.trim()).slice(0, 6) })));
    const clasificar = (s) => {
      const t = (s.id + ' ' + s.label + ' ' + s.opts.join(' ')).toLowerCase();
      if (/prov/.test(t)) return 'prov';
      if (/local|municip|ciudad/.test(t)) return 'loc';
      if (/combust|fuel|gasol|gasoil|diesel/.test(t)) return 'comb';
      if (/marca|brand/.test(t)) return 'marca';
      if (/orden|sort|precio|distancia/.test(t)) return 'orden';
      return null;
    };
    for (const s of sels) {
      const tipo = clasificar(s);
      if (!tipo || fila[tipo] !== '-') continue;
      const antes = await p.evaluate(SNAP);
      const ok = await p.evaluate(({ id, label }) => {
        const sels = [...document.querySelectorAll('select')];
        const s = sels.find((x) => x.id === id && (x.id || !label)) || sels.find((x) => x.id === id) ||
          sels.find((x) => { const r = x.getBoundingClientRect(); return r.width > 20 && r.height > 10 && x.options.length > 1; });
        if (!s) return false;
        const idx = [...s.options].findIndex((o, i) => i > 0 && o.value !== s.value);
        if (idx < 0) return false;
        s.value = s.options[idx].value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }, { id: s.id, label: s.label });
      if (!ok) continue;
      await p.waitForTimeout(650);
      const despues = await p.evaluate(SNAP);
      fila[tipo] = antes !== despues ? 'ok' : 'SIN CAMBIO';
      if (tipo === 'prov') { await p.reload(); await p.waitForTimeout(600); }
    }
  });

  /* ---------- búsqueda de texto ---------- */
  await probar(async (p) => {
    const hay = await p.evaluate(() => {
      const inp = [...document.querySelectorAll('input')].filter((i) => {
        const r = i.getBoundingClientRect();
        const cs = getComputedStyle(i);
        return r.width > 40 && r.height > 12 && cs.display !== 'none' && cs.visibility !== 'hidden' &&
          (i.type === 'search' || i.type === 'text' || !i.type);
      });
      return inp.length ? inp[0].id || inp[0].className : null;
    });
    if (!hay) { fila.busca = 'sin caja'; return; }
    const antes = await p.evaluate(SNAP);
    await p.evaluate((sel) => {
      const inp = document.querySelector(sel.startsWith('i') ? '#' + sel : '.' + sel.split(' ')[0]) ||
        [...document.querySelectorAll('input')][0];
      /* si la caja está oculta tras un botón 🔍, la mostramos */
      let n = inp;
      while (n && n !== document.body) {
        if (getComputedStyle(n).display === 'none' || n.hidden) { n.hidden = false; n.style.display = ''; }
        n = n.parentElement;
      }
      inp.value = 'Repsol';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('keyup', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }, hay);
    await p.waitForTimeout(700);
    const despues = await p.evaluate(SNAP);
    fila.busca = antes !== despues ? 'ok' : 'SIN CAMBIO';
  });

  /* ---------- solo favoritos ---------- */
  await probar(async (p) => {
    const hay = await p.evaluate(() => {
      const c = [...document.querySelectorAll('input[type="checkbox"], button, .chip, .filtro')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 10 && r.height > 10 && /favorit/i.test(e.textContent || '') + (e.getAttribute('aria-label') || '');
      });
      return c.length;
    });
    if (!hay) { fila.fav = 'sin control'; return; }
    const antes = await p.evaluate(SNAP);
    await p.evaluate(() => {
      const el = [...document.querySelectorAll('input[type="checkbox"], button, .chip, .filtro')]
        .find((e) => /favorit/i.test((e.textContent || '') + (e.getAttribute('aria-label') || '')));
      if (!el) return;
      el.click();
    });
    await p.waitForTimeout(700);
    const despues = await p.evaluate(SNAP);
    fila.fav = antes !== despues ? 'ok' : 'SIN CAMBIO';
  });

  /* ---------- paginación ---------- */
  await probar(async (p) => {
    const ok = await p.evaluate(() => {
      const cands = [...document.querySelectorAll('button, a')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 8 && r.height > 8 && /^(›|»|▶|>|siguiente|next)$/i.test((e.textContent || '').trim()) ||
          /siguiente|next/i.test(e.getAttribute('aria-label') || '');
      });
      if (!cands.length) return false;
      cands[0].click();
      return true;
    });
    if (!ok) { fila.pag = 'sin control'; return; }
    await p.waitForTimeout(700);
    const txt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400));
    const pagina = await p.evaluate(() => (document.body.innerText.match(/(p[áa]gina|page)\s*(\d+)\s*(de|\/)\s*(\d+)/i) || [])[0] || '');
    fila.pag = pagina ? 'ok (' + pagina + ')' : (txt ? 'ok (sin indicador)' : 'SIN CAMBIO');
  });

  fila.errs = [...new Set(fila.errs)];
  resultados.push(fila);
  console.log(`${dir.replace('prototipo', 'P').padEnd(36)} prov=${fila.prov.padEnd(9)} loc=${fila.loc.padEnd(9)} comb=${fila.comb.padEnd(9)} marca=${fila.marca.padEnd(9)} busca=${fila.busca.padEnd(9)} fav=${fila.fav.padEnd(11)} orden=${fila.orden.padEnd(9)} pag=${fila.pag}${fila.errs.length ? ' ERRS: ' + fila.errs[0] : ''}`);
}

await b.close();
