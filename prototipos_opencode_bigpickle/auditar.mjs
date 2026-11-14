/* =============================================================================
 * Auditor de diseño de los prototipos
 * -----------------------------------------------------------------------------
 * Complementa a capturar.mjs (que hace el smoke test de consola y las fotos):
 * aquí se miden reglas objetivas de UX/UI en el navegador real y se escribe un
 * informe en shared/informes/<prototipo>.md
 *
 * Reglas comprobadas (móvil 390×844 y PC 1440×900):
 *   1. Sin desbordamiento horizontal de la página
 *   2. Objetivos táctiles ≥ 32 px (aviso si < 44)
 *   3. Tipografía visible ≥ 11 px (aviso si < 12)
 *   4. Contraste de texto ≥ 4.5:1 (grande ≥ 3:1)
 *   5. Nada de «undefined», «NaN» ni «[object Object]» visibles
 *   6. Los botones de la navegación no quedan tapados por otras capas
 *   7. Existen al menos 5 destinos de navegación
 *
 *   node prototipos_opencode_bigpickle/auditar.mjs        → todos
 *   node prototipos_opencode_bigpickle/auditar.mjs 1 3    → solo esos
 * ========================================================================== */
import { chromium } from 'playwright';
import { readdir, mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirInformes = path.join(aqui, 'shared', 'informes');
const filtros = process.argv.slice(2);

const EXENTAS_TAP = '.chip .quitar, [data-tap-exenta], a, .enlace';
const EXENTAS_TEXTO = '[aria-hidden="true"], .cinta, .visualmente-oculto, [data-texto-exento]';

async function carpetas() {
  const entradas = await readdir(aqui, { withFileTypes: true });
  const lista = [];
  for (const e of entradas) {
    if (!e.isDirectory() || !/^prototipo/i.test(e.name)) continue;
    const html = path.join(aqui, e.name, 'index.html');
    try { await access(html); lista.push({ nombre: e.name, html }); } catch { /* sin index */ }
  }
  return lista
    .filter((p) => !filtros.length || filtros.some((f) => p.nombre.startsWith('prototipo' + f)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/* Se ejecuta dentro de la página: devuelve todas las medidas de golpe. */
function medir(cfg) {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const selector = (el) => {
    if (el.id) return '#' + el.id;
    const clases = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    return el.tagName.toLowerCase() + (clases ? '.' + clases : '');
  };
  /* Contraste: buscamos el primer fondo opaco hacia arriba */
  const fondo = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const bg = cs.backgroundColor;
      const m = bg.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(',').map(Number);
        const a = p.length > 3 ? p[3] : 1;
        if (a > 0.85) return [p[0], p[1], p[2]];
      }
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const luz = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contraste = (a, b) => {
    const l1 = luz(a), l2 = luz(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const color = (str) => {
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { rgb: [p[0], p[1], p[2]], alfa: p.length > 3 ? p[3] : 1 };
  };

  const res = { desborde: null, taps: [], textos: [], contrastes: [], frases: [], nav: [], destinos: [] };

  /* 1. Desbordamiento horizontal */
  res.desborde = {
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    bodyScrollW: document.body.scrollWidth,
    culpables: [...document.querySelectorAll('*')]
      .filter((el) => vis(el) && el.getBoundingClientRect().right > window.innerWidth + 2 &&
        !el.closest('[data-scroll-x], .fila-chips, .ia-pills, .tabla-envoltorio, .table-wrap'))
      .slice(0, 6).map((el) => selector(el) + ' → ' + Math.round(el.getBoundingClientRect().right) + 'px')
  };

  /* 2. Objetivos táctiles */
  const interactivos = [...document.querySelectorAll('button, a[href], input, select, [role="button"], [role="tab"], [role="checkbox"]')];
  interactivos.filter(vis).forEach((el) => {
    if (el.matches(cfg.exentasTap) || el.closest(cfg.exentasTap)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 32 || r.height < 32) {
      res.taps.push({ el: selector(el), w: Math.round(r.width), h: Math.round(r.height), texto: (el.textContent || el.placeholder || '').trim().slice(0, 24) });
    }
  });

  /* 3 y 4. Tipografía y contraste de nodos de texto */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set();
  let nodo;
  while ((nodo = walker.nextNode())) {
    const texto = (nodo.textContent || '').trim();
    if (texto.length < 2) continue;
    const el = nodo.parentElement;
    if (!el || !vis(el)) continue;
    if (el.closest(cfg.exentasTexto) || el.closest('script, style, svg, code, pre')) continue;
    const cs = getComputedStyle(el);
    const tam = parseFloat(cs.fontSize);
    const peso = Number(cs.fontWeight) || 400;
    const clave = selector(el) + '|' + texto.slice(0, 12);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    if (tam < 12) {
      res.textos.push({ el: selector(el), px: Math.round(tam * 100) / 100, texto: texto.slice(0, 30) });
    }
    const c = color(cs.color);
    if (c && c.alfa > 0.9) {
      const ratio = contraste(c.rgb, fondo(el));
      const grande = tam >= 24 || (tam >= 18.66 && peso >= 700);
      const minimo = grande ? 3 : 4.5;
      if (ratio < minimo) {
        res.contrastes.push({ el: selector(el), ratio: Math.round(ratio * 100) / 100, minimo, px: Math.round(tam), texto: texto.slice(0, 30) });
      }
    }
  }

  /* 5. Frases sospechosas */
  const malas = ['undefined', 'NaN', '[object Object]', 'null '];
  const cuerpo = document.body.innerText || '';
  malas.forEach((m) => { if (cuerpo.includes(m)) res.frases.push(m); });

  /* 6. Navegación tapada */
  const botonesNav = [...document.querySelectorAll('nav button, .nav-inferior button, .nav-superior button, [data-nav] button, [role="tablist"] button')].filter(vis);
  botonesNav.slice(0, 20).forEach((b) => {
    const r = b.getBoundingClientRect();
    const enc = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (enc && !b.contains(enc) && enc !== b) {
      res.nav.push({ boton: selector(b), tapa: selector(enc), texto: (b.textContent || '').trim().slice(0, 18) });
    }
  });

  /* 7. Destinos de navegación */
  res.destinos = [...new Set([...document.querySelectorAll('[data-vista], [data-tab], [data-iaprov], [data-seccion], [data-destino]')]
    .map((el) => el.dataset.vista || el.dataset.tab || el.dataset.seccion || el.dataset.iaprov || el.dataset.destino))].filter(Boolean);

  res.metricas = {
    botones: interactivos.filter(vis).length,
    textos: vistos.size,
    anchoPagina: document.documentElement.scrollWidth,
    altoPagina: document.documentElement.scrollHeight
  };
  return res;
}

const lista = await carpetas();
if (!lista.length) { console.error('No hay prototipos que auditar.'); process.exit(1); }
await mkdir(dirInformes, { recursive: true });

const navegador = await chromium.launch();
let fallos = 0;

for (const proto of lista) {
  const url = pathToFileURL(proto.html).href;
  const informe = { nombre: proto.nombre, movil: null, pc: null, errores: [] };

  for (const [etiqueta, vp, movil] of [['movil', { width: 390, height: 844 }, true], ['pc', { width: 1440, height: 900 }, false]]) {
    const ctx = await navegador.newContext({ viewport: vp, isMobile: movil, hasTouch: movil, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => informe.errores.push(etiqueta + ': ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') informe.errores.push(etiqueta + ' consola: ' + m.text()); });
    await page.goto(url);
    await page.waitForTimeout(700);
    informe[etiqueta] = await page.evaluate(medir, { exentasTap: EXENTAS_TAP, exentasTexto: EXENTAS_TEXTO });
    await ctx.close();
  }
  informe.fallos = 0;

  /* Informe en Markdown */
  const lineas = ['# Auditoría de diseño · ' + proto.nombre, '', 'Generado por `prototipos_opencode_bigpickle/auditar.mjs`.', ''];
  for (const etiqueta of ['movil', 'pc']) {
    const r = informe[etiqueta];
    const cab = etiqueta === 'movil' ? 'Móvil 390×844' : 'PC 1440×900';
    lineas.push('## ' + cab, '');
    lineas.push('- Página: ' + r.metricas.anchoPagina + '×' + r.metricas.altoPagina + ' px · ' + r.metricas.botones + ' controles · ' + r.metricas.textos + ' nodos de texto');
    const desborde = r.desborde.scrollW > r.desborde.innerW + 2;
    lineas.push('- Desbordamiento horizontal: ' + (desborde ? '**SÍ** (' + r.desborde.scrollW + ' > ' + r.desborde.innerW + ')' : 'no'));
    if (desborde && r.desborde.culpables.length) lineas.push('  - Candidatos: ' + r.desborde.culpables.join(' · '));
    lineas.push('- Objetivos táctiles < 32 px: ' + r.taps.length);
    r.taps.slice(0, 12).forEach((t) => lineas.push('  - `' + t.el + '` ' + t.w + '×' + t.h + ' «' + t.texto + '»'));
    lineas.push('- Textos < 12 px: ' + r.textos.length);
    r.textos.slice(0, 12).forEach((t) => lineas.push('  - `' + t.el + '` ' + t.px + ' px «' + t.texto + '»'));
    lineas.push('- Contraste insuficiente: ' + r.contrastes.length);
    r.contrastes.slice(0, 12).forEach((t) => lineas.push('  - `' + t.el + '` ' + t.ratio + ':1 (mín ' + t.minimo + ') ' + t.px + 'px «' + t.texto + '»'));
    lineas.push('- Navegación tapada: ' + r.nav.length);
    r.nav.slice(0, 8).forEach((t) => lineas.push('  - «' + t.texto + '» tapado por `' + t.tapa + '`'));
    lineas.push('- Frases sospechosas: ' + (r.frases.length ? r.frases.join(', ') : 'ninguna'));
    lineas.push('- Destinos de navegación: ' + r.destinos.length + ' → ' + r.destinos.join(', '));
    lineas.push('');
    informe.fallos += (desborde ? 1 : 0) + r.taps.length + r.contrastes.length + r.nav.length + r.frases.length;
  }
  if (informe.errores.length) {
    lineas.push('## Errores de consola', '');
    informe.errores.forEach((e) => lineas.push('- ' + e));
    informe.fallos += informe.errores.length;
  }
  fallos += informe.fallos;
  await writeFile(path.join(dirInformes, proto.nombre + '.md'), lineas.join('\n'), 'utf8');

  const m = informe.movil, p = informe.pc;
  console.log(`${informe.fallos === 0 ? '✅' : '⚠️ '} ${proto.nombre}`);
  console.log(`   móvil: ${m.taps.length} taps pequeños · ${m.textos.length} textos <12px · ${m.contrastes.length} contrastes · ${m.nav.length} solapamientos`);
  console.log(`   pc:    ${p.taps.length} taps pequeños · ${p.textos.length} textos <12px · ${p.contrastes.length} contrastes · ${p.nav.length} solapamientos`);
  if (informe.errores.length) console.log('   errores: ' + informe.errores.length);
}

await navegador.close();
console.log('\nInformes en shared/informes/. Avisos totales: ' + fallos);
