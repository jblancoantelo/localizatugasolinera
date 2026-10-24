/* Depuración visual de v4: IA, ajustes, descuentos y paginación desde la consola
   Uso: node prototipos_opencode_deepseekv4.1flashfree/_dbg-v4.cjs */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await p.goto(RAIL + 'v4-desktop.html?embed=1');
  await p.waitForTimeout(700);

  /* IA desde la barra superior */
  await p.click('#iaBtn4');
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '_dbg-v4-ia.png' });
  await p.click('.pf-ia-prompts .chip');
  await p.waitForTimeout(2600);
  await p.screenshot({ path: OUT + '_dbg-v4-ia-respuesta.png' });
  await p.click('.pf-cite');
  await p.waitForTimeout(700);
  await p.screenshot({ path: OUT + '_dbg-v4-inspector-desde-ia.png' });
  const inspSel = await p.evaluate(() => document.querySelector('#table tr.sel')?.dataset.id || null);
  console.log('[check] estación seleccionada tras la cita:', inspSel);

  /* Ajustes desde la barra superior */
  await p.click('#cfgBtn4');
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '_dbg-v4-ajustes.png' });
  /* Descuento REPSOL al máximo */
  await p.evaluate(() => {
    const r = document.querySelector('[data-disc="REPSOL"]');
    r.value = r.max; r.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '_dbg-v4-ajustes-descuento.png' });
  /* Paginación: 10 por página */
  await p.click('[data-sec="paging"] [data-psize="10"]');
  await p.waitForTimeout(400);
  await p.click('.pf-overlay.on [data-pf-close]');
  await p.waitForTimeout(400);
  const rows = await p.evaluate(() => document.querySelectorAll('#table tbody tr').length);
  console.log('[check] filas tras paginar a 10:', rows);
  await p.screenshot({ path: OUT + '_dbg-v4-tabla-10.png' });

  /* Palette: comandos IA y ajustes */
  await p.keyboard.press('Control+k');
  await p.waitForTimeout(300);
  await p.type('#cmdkInput', 'copiloto');
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '_dbg-v4-cmdk-ia.png' });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '_dbg-v4-cmdk-abre-ia.png' });
  await p.click('.pf-overlay.on [data-pf-close]');
  await p.waitForTimeout(300);

  /* Ocultar groq desde ajustes y comprobar en IA */
  await p.click('#cfgBtn4');
  await p.waitForTimeout(400);
  await p.evaluate(() => { document.querySelector('[data-sec="iatabs"]').scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(250);
  await p.click('[data-iatab="groq"]');
  await p.waitForTimeout(300);
  await p.click('.pf-overlay.on [data-pf-close]');
  await p.waitForTimeout(300);
  await p.click('#iaBtn4');
  await p.waitForTimeout(500);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.pf-ia-tabs .chip:not([hidden])')].map(c => c.dataset.p).join(', '));
  console.log('[check] pestañas IA visibles tras ocultar groq:', tabs);

  await b.close();
  console.log('capturas v4 listas');
})();
