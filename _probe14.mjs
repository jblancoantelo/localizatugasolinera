import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = path.resolve('prototipos_opencode_bigpickle');
const b = await chromium.launch();

async function abrir(dir, w = 390, h = 844) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(3000);
  await p.goto(pathToFileURL(path.join(base, dir, 'index.html')).href);
  await p.waitForTimeout(700);
  return { ctx, p };
}

for (const dir of ['prototipo1-mapa-hojas', 'prototipo6-gestos-atajos']) {
  for (const chip of ['fuel', 'loc', 'marcas', 'orden', 'dist']) {
    const { ctx, p } = await abrir(dir);
    await p.evaluate((c) => document.querySelector(`[data-chip="${c}"]`).click(), chip);
    await p.waitForTimeout(500);
    const d = await p.evaluate(() => ({
      titulo: document.querySelector('#opcTitulo')?.textContent.trim(),
      cuerpo: [...document.querySelectorAll('#opcCuerpo > *')].slice(0, 14).map((e) => e.className + '[' + (e.getAttribute('data-opcion') || '') + ']=' + (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28)),
      pie: [...document.querySelectorAll('#opcPie button')].map((e) => e.textContent.trim()),
      inputs: [...document.querySelectorAll('#opcCuerpo input')].map((i) => i.type + ':' + i.value),
    }));
    console.log(dir.replace('prototipo', 'P').split('-')[0], chip, JSON.stringify(d));
    await ctx.close();
  }
}

/* P3: hoja de filtros y hoja de combustible */
for (const acc of ['filtros', 'combustible', 'marcas', 'distancia']) {
  const { ctx, p } = await abrir('prototipo3-lista-tarjetas');
  await p.evaluate((a) => document.querySelector(`[data-accion="${a}"]`).click(), acc);
  await p.waitForTimeout(600);
  const d = await p.evaluate(() => ({
    hojas: [...document.querySelectorAll('.hoja')].filter((h) => !h.hidden).map((h) => h.id + ':' + (h.innerText || '').replace(/\s+/g, ' ').slice(0, 260)),
    aplicar: [...document.querySelectorAll('#fAplicar, .btn-primario-grande')].map((e) => e.textContent.trim()),
    inputs: [...document.querySelectorAll('.hoja:not([hidden]) input')].map((i) => i.type + ':' + (i.id || i.value || i.name)),
  }));
  console.log('P3', acc, JSON.stringify(d));
  await ctx.close();
}
await b.close();
