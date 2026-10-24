const { chromium } = require('playwright');
const path = require('path');
const url = (f) => 'file:///' + path.resolve(__dirname, f).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(url('v6-drive.html'));
  await page.waitForTimeout(600);
  await page.click('#moreBtn');
  await page.waitForTimeout(500);
  console.log('--- click real en la fila ---');
  await page.click('[data-sheet-open="opts"]');
  await page.waitForTimeout(700);
  console.log(await page.evaluate(() => ({
    more: document.getElementById('moreSheet').className,
    opts: document.getElementById('optsSheet').className,
    snap: document.getElementById('optsSheet').dataset.snap,
    y: getComputedStyle(document.getElementById('optsSheet')).getPropertyValue('--sheet-y'),
  })));
  await browser.close();
})();
