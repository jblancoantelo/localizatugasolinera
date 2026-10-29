import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const base = path.resolve('.');
const protos = fs.readdirSync(base).filter(d => d.startsWith('prototipo') && fs.statSync(path.join(base,d)).isDirectory()).sort();
const browser = await chromium.launch();
const res = [];
for (const p of protos) {
  const url = pathToFileURL(path.resolve(base, p, 'index.html')).href;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  try {
    await page.goto(url, { timeout: 30000 });
    await page.waitForTimeout(400);
    const checks = await page.evaluate(() => {
      const out = {};
      out.hasData = typeof window.FAKE !== 'undefined';
      out.provs = document.querySelectorAll('option[value]').length;
      out.btns = document.querySelectorAll('button').length;
      out.inputs = document.querySelectorAll('input,select').length;
      out.canvas = document.querySelectorAll('canvas').length;
      out.svg = document.querySelectorAll('svg').length;
      out.tabs = document.querySelectorAll('[data-vista],.nav button,[role=tab]').length;
      // try to find filters
      out.hasFiltro = !!(document.querySelector('#selProv,#fProvincia,.chip[data-chip="prov"],[data-filtro="prov"]'));
      out.hasCombust = !!(document.querySelector('#selFuel,#selCombustible,#fCombustible,[data-filtro="combustible"]'));
      out.hasMarca = !!(document.querySelector('#btnMarcas,[data-chip="marca"],#fMarcas,.marca'));
      out.hasFav = !!(document.querySelector('#chkFav,[data-fav],.fav'));
      out.hasBuscar = !!(document.querySelector('#buscar,#buscador,#filtroTexto'));
      out.hasIA = !!(document.querySelector('.ia,.chat,[data-vista="ia"],[data-panel="ia"]'));
      out.hasConfig = !!(document.querySelector('[data-vista="config"],.config,[data-panel="config"]'));
      out.hasMapa = !!(document.querySelector('#mapa,.mapa,svg.map'));
      out.hasDetalle = !!(document.querySelector('#ficha,.detalle,.panel-detalle'));
      // try open detail
      return out;
    });
    // try to open detail if possible
    try {
      const open = await page.evaluate(() => {
        const b = document.querySelector('[data-ficha], .btn-detalle, .tarjeta button, tr[data-id] button');
        if (b) { b.click(); return 'clicked'; }
        // try first card
        const c = document.querySelector('.tarjeta-estacion, .fila, .item');
        if (c) { c.click(); return 'clicked-card'; }
        return 'none';
      });
      if (open !== 'none') { await page.waitForTimeout(300); }
    } catch(e){}
    const detail = await page.evaluate(() => {
      return {
        fichaVis: !!(document.querySelector('#ficha:not([hidden]),.ficha:not([hidden]),.detalle:not(.oculto)')),
        canvasPts: document.querySelector('canvas')?._pts?.length || 0,
        hasHist: !!(document.querySelector('.historico,.historia,[data-hist]'))
      };
    });
    res.push({ p, ok: errs.length===0, errs: errs.slice(0,2), ...checks, ...detail });
  } catch(e) {
    res.push({ p, ok: false, err: e.message });
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(JSON.stringify(res, null, 2));
