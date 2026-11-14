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
const informe = {};

const vis = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' &&
    r.bottom > 0 && r.top < innerHeight;
};

const HELPERS = `
  window.__vis = ${vis.toString()};
  window.__sig = (sel) => {
    const el = sel ? document.querySelector(sel) : document.body;
    const t = (el ? el.innerText : '').replace(/\\s+/g, ' ').trim();
    return t.length + '|' + t.slice(0, 200);
  };
  window.__selectProv = () => [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => /madrid|barcelona|valencia|sevilla/i.test(o.textContent)));
  window.__selectFuel = () => [...document.querySelectorAll('select')].find((s) =>
    [...s.options].some((o) => /di[eé]sel|gasolina 95|95 e5|glp/i.test(o.textContent)));
`;

async function abrir(dir, w = 1440, h = 900) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(2500);
  const errores = [];
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  await page.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await page.waitForTimeout(600);
  await page.evaluate(HELPERS);
  return { ctx, page, errores };
}

async function clicVista(page, nombre) {
  const cands = [
    `button[data-vista="${nombre}"]`,
    `button[data-destino="${nombre}"]`,
    `[role="tab"][data-tab="${nombre}"]`,
    `[role="tab"][data-vista="${nombre}"]`,
  ];
  for (const sel of cands) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      const v = await loc.evaluate((el) => window.__vis(el));
      if (!v) continue;
      await loc.click({ force: true }).catch(() => {});
      await page.waitForTimeout(450);
      return sel;
    }
  }
  return null;
}

for (const dir of dirs) {
  const { ctx, page, errores } = await abrir(dir);
  const R = {};

  /* ---- Filtros: provincia y combustible ---- */
  for (const [clave, tipo] of [['filtroProvincia', 'prov'], ['filtroCombustible', 'fuel']]) {
    try {
      const res = await page.evaluate((t) => {
        const sig = () => {
          const el = document.querySelector('#listaTarjetas, #lista, #listaScroll, .tabla-cuerpo, .table-wrap, #resultados');
          const x = (el ? el.innerText : '').replace(/\s+/g, ' ').trim();
          return x.length + '|' + x.slice(0, 200);
        };
        const todos = [...document.querySelectorAll('select')];
        const re = t === 'prov' ? /madrid|barcelona|valencia|sevilla/i : /di[eé]sel|gasolina 95|95 e5|glp/i;
        const sel = todos.find((s) => [...s.options].some((o) => re.test(o.textContent)));
        if (!sel) return { hay: false };
        const antes = { sig: sig(), valores: todos.map((s) => s.options.length) };
        const idx = [...sel.options].findIndex((o) => o.value && o.value !== sel.value);
        if (idx < 0) return { hay: true, ok: false };
        sel.value = sel.options[idx].value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { hay: true, ok: true, antes };
      }, tipo);
      if (!res.hay) { R[clave] = 'n/a'; continue; }
      await page.waitForTimeout(700);
      const despues = await page.evaluate(() => {
        const el = document.querySelector('#listaTarjetas, #lista, #listaScroll, .tabla-cuerpo, .table-wrap, #resultados');
        const x = (el ? el.innerText : '').replace(/\s+/g, ' ').trim();
        return {
          sig: x.length + '|' + x.slice(0, 200),
          valores: [...document.querySelectorAll('select')].map((s) => s.options.length),
          filas: document.querySelectorAll('[data-id], [data-fila], [data-estacion], .tarjeta, tbody tr').length,
        };
      });
      const cambio = res.ok && (despues.sig !== res.antes.sig || JSON.stringify(despues.valores) !== JSON.stringify(res.antes.valores));
      R[clave] = cambio ? 'si' : 'NO';
      if (!cambio) (R.notas ||= []).push(clave + ': sin reacción (filas=' + despues.filas + ')');
    } catch (e) { R[clave] = 'NO'; (R.notas ||= []).push(clave + ': ' + e.message.split('\n')[0]); }
  }

  /* ---- Búsqueda ---- */
  try {
    let input = page.locator('input[type="search"]:visible, input[placeholder*="uscar"]:visible, input[placeholder*="Buscar"]:visible').first();
    if (!(await input.count())) {
      const toggle = page.locator('[aria-label*="uscar" i]:visible, [aria-label*="búsqueda" i]:visible').first();
      if (await toggle.count()) { await toggle.click({ force: true }).catch(() => {}); await page.waitForTimeout(350); }
      input = page.locator('input[type="search"]:visible, input[placeholder*="uscar"]:visible, input[placeholder*="Buscar"]:visible').first();
    }
    if (!(await input.count())) { R.busqueda = 'n/a'; }
    else {
      const antes = await page.evaluate(() => window.__sig('#listaTarjetas, #lista, #listaScroll, .tabla-cuerpo, .table-wrap, #resultados'));
      await input.fill('repsol');
      await page.waitForTimeout(700);
      const despues = await page.evaluate(() => window.__sig('#listaTarjetas, #lista, #listaScroll, .tabla-cuerpo, .table-wrap, #resultados'));
      R.busqueda = despues !== antes ? 'si' : 'NO';
      if (despues === antes) (R.notas ||= []).push('busqueda: sin reacción');
      await input.fill('');
      await page.waitForTimeout(200);
    }
  } catch (e) { R.busqueda = 'NO'; (R.notas ||= []).push('busqueda: ' + e.message.split('\n')[0]); }

  /* ---- Favoritos ---- */
  try {
    const existe = await page.evaluate(() => !!document.querySelector('.fav-btn, [data-accion="favorito"], [data-fav], [aria-label*="avorit" i], #fSoloFav, #chkFavoritos'));
    if (!existe) R.favoritos = 'n/a';
    else {
      const fav = page.locator('.fav-btn:visible, [data-accion="favorito"]:visible, [data-fav]:visible, [aria-label*="avorit" i]:visible').first();
      if (!(await fav.count())) R.favoritos = 'UI';
      else {
        const antes = await fav.evaluate((el) => el.outerHTML.slice(0, 120));
        await fav.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        const despues = await fav.evaluate((el) => el.outerHTML.slice(0, 120)).catch(() => antes);
        R.favoritos = despues !== antes ? 'si' : 'UI';
        if (despues === antes) (R.notas ||= []).push('favoritos: control sin cambio de estado');
      }
    }
  } catch (e) { R.favoritos = 'NO'; (R.notas ||= []).push('favoritos: ' + e.message.split('\n')[0]); }

  /* ---- Detalle + histórico ---- */
  try {
    const disparador = page.locator('[data-shot="detalle"]:visible, [data-accion="abrir-detalle"]:visible').first();
    if (!(await disparador.count())) { R.detalle = 'n/a'; }
    else {
      await disparador.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
      const abierto = await page.evaluate(() => {
        const cands = ['#detalle', '#panelDetalle', '#ficha', '.detalle', '.panel-detalle', '[role="dialog"]'];
        return cands.some((s) => [...document.querySelectorAll(s)].some((e) => window.__vis(e)));
      });
      R.detalle = abierto ? 'si' : 'NO';
      if (!abierto) (R.notas ||= []).push('detalle: no se hizo visible');

      /* pestaña de histórico dentro del detalle */
      const tabHist = page.locator('#detalle button:has-text("Histórico"), .detalle button:has-text("Histórico"), [role="tab"]:has-text("Histórico")').first();
      if (await tabHist.count()) {
        const v = await tabHist.evaluate((el) => window.__vis(el));
        if (v) { await tabHist.click({ force: true }).catch(() => {}); await page.waitForTimeout(700); }
      }
      const med = await page.evaluate(() => {
        const cs = [...document.querySelectorAll('canvas')].filter(window.__vis);
        const pintados = cs.filter((c) => {
          try {
            const ctx = c.getContext('2d');
            const d = ctx.getImageData(0, 0, Math.max(1, c.width), Math.max(1, c.height)).data;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
          } catch { return false; }
          return false;
        });
        const selects = [...document.querySelectorAll('select')].filter(window.__vis).map((s) => s.id || s.className);
        return { canvas: cs.length, pintados: pintados.length, selects };
      });
      R.detalleCanvas = med.pintados > 0 ? 'si' : 'NO';
      R.detalleSelectores = med.selects.filter((s) => /fuel|comb|dias|period|rango/i.test(s)).length >= 2 ? 'si' : 'NO';
      (R.notas ||= []).push('detalle: canvas visibles=' + med.canvas + ' pintados=' + med.pintados + ' selects=' + med.selects.join(','));
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(250);
    }
  } catch (e) { R.detalle = 'NO'; (R.notas ||= []).push('detalle: ' + e.message.split('\n')[0]); }

  /* ---- IA ---- */
  try {
    let nav = await clicVista(page, 'ia');
    if (!nav) {
      const b2 = page.locator('button:has-text("IA"):visible').first();
      if (await b2.count()) { await b2.click({ force: true }).catch(() => {}); await page.waitForTimeout(450); nav = 'texto'; }
    }
    const input = page.locator('#iaInput:visible, #chatInput:visible, input[placeholder*="Pregunta"]:visible').first();
    if (!(await input.count())) R.ia = 'n/a';
    else {
      R.ia = 'si';
      const cuenta = () => page.evaluate(() => document.querySelectorAll('.ia-msg, .msg, .mensaje, .burbuja, .chat-msg, [class*="ia-burbuja"]').length);
      const antes = await cuenta();
      await input.fill('¿Cuál es la gasolinera más barata?');
      const enviar = page.locator('#iaEnviar:visible, #chatEnviar:visible, [data-iaenviar]:visible, button[type="submit"]:has-text("Enviar"):visible').first();
      if (await enviar.count()) await enviar.click({ force: true }).catch(() => {});
      else await input.press('Enter').catch(() => {});
      await page.waitForTimeout(1600);
      const despues = await cuenta();
      R.iaRespuesta = despues > antes ? 'si' : 'NO';
      (R.notas ||= []).push('ia: burbujas ' + antes + '→' + despues);
    }
  } catch (e) { R.ia = 'NO'; (R.notas ||= []).push('ia: ' + e.message.split('\n')[0]); }

  /* ---- Config ---- */
  try {
    let nav = await clicVista(page, 'config');
    if (!nav) nav = await clicVista(page, 'ajustes');
    if (!nav) {
      const b3 = page.locator('button:has-text("Ajustes"):visible, [data-destino="ajustes"]:visible, [data-seccion="ajustes"]:visible').first();
      if (await b3.count()) { await b3.click({ force: true }).catch(() => {}); await page.waitForTimeout(500); nav = 'texto'; }
    }
    if (!nav) { R.config = 'n/a'; }
    else {
      await page.waitForTimeout(500);
      const txt = await page.evaluate(() => document.body.innerText.toLowerCase());
      const c = {
        paginacion: /paginaci[óo]n|por p[áa]gina/.test(txt),
        cache: /cach[eé]/.test(txt),
        push: /notificaci|push/.test(txt),
        claves: /clave|api key|proveedor/.test(txt),
        version: /versi[óo]n|actualizaci[óo]n/.test(txt),
        logs: /registro|log de actividad/.test(txt),
      };
      R.config = Object.values(c).filter(Boolean).length + '/6';
      (R.notas ||= []).push('config: ' + JSON.stringify(c));
    }
  } catch (e) { R.config = 'NO'; (R.notas ||= []).push('config: ' + e.message.split('\n')[0]); }

  /* ---- Mapa ---- */
  try {
    await clicVista(page, 'mapa');
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({
      marcadores: document.querySelectorAll('.marcador, .pin, [data-accion="marcador"], .estacion-pin, .pin-precio').length,
      leyenda: /barata|leyenda|€\/l/i.test(document.body.innerText),
      estilos: [...document.querySelectorAll('select')].filter((s) => [...s.options].some((o) => /sat[ée]lite|oscuro|claro/i.test(o.textContent))).length,
      zoom: [...document.querySelectorAll('button')].filter((b) => /zoom|acercar|alejar/i.test((b.getAttribute('aria-label') || '') + b.textContent)).length,
    }));
    R.mapa = m.marcadores > 0 ? 'si' : 'NO';
    R.mapaDetalle = `marcad=${m.marcadores} estilos=${m.estilos} leyenda=${m.leyenda ? 'si' : 'no'} zoom=${m.zoom}`;
  } catch (e) { R.mapa = 'NO'; (R.notas ||= []).push('mapa: ' + e.message.split('\n')[0]); }

  R.errores = errores.slice(0, 6);
  informe[dir] = R;
  await ctx.close();
}

await b.close();
fs.writeFileSync('_paridad.json', JSON.stringify(informe, null, 2));

const cols = ['filtroProvincia', 'filtroCombustible', 'busqueda', 'favoritos', 'detalle', 'detalleCanvas', 'detalleSelectores', 'ia', 'iaRespuesta', 'config', 'mapa'];
console.log('Prototipo'.padEnd(36) + cols.map((c) => c.replace('detalleSelectores', 'detSel').replace('filtroProvincia', 'prov').replace('filtroCombustible', 'comb').slice(0, 9).padEnd(10)).join(''));
for (const [k, v] of Object.entries(informe)) {
  console.log(k.replace('prototipo', 'P').padEnd(36) + cols.map((c) => String(v[c] ?? '-').slice(0, 9).padEnd(10)).join(''));
}
console.log('\nErrores de consola:');
let hayErr = false;
for (const [k, v] of Object.entries(informe)) if (v.errores.length) { hayErr = true; console.log(' ' + k + ': ' + v.errores.join(' | ')); }
if (!hayErr) console.log(' ninguno');
console.log('\nNotas:');
for (const [k, v] of Object.entries(informe)) if (v.notas) console.log(' ' + k.replace('prototipo', 'P') + ':\n   ' + v.notas.join('\n   '));
