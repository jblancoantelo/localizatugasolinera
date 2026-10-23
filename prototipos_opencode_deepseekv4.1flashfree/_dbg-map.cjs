/* Depuración visual del mapa sintético dentro de v1-sheet.html (borrar al final) */
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.join(__dirname, 'capturas') + path.sep;

(async () => {
  const b = await chromium.launch({ headless: true, channel: 'chrome' });
  for (const vp of [{ name: 'movil', width: 390, height: 844 }, { name: 'escritorio', width: 1440, height: 900 }]) {
    for (const theme of ['light', 'dark']) {
      const p = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
      await p.goto('file:///' + __dirname.replace(/\\/g, '/') + `/v1-sheet.html?embed=1&theme=${theme}`);
      await p.waitForTimeout(300);
      if (vp.width < 700) { await p.click('nav .nav-btn:nth-child(2)'); }
      else { await p.click('.topnav button:nth-child(2)'); }
      await p.waitForTimeout(900);
      const pm = await p.$('.pm');
      await (pm || p).screenshot({ path: OUT + `_dbg-mapa-${vp.name}-${theme}.png` });
      await p.close();
    }
  }
  await b.close();
  console.log('capturas listas');
})();
