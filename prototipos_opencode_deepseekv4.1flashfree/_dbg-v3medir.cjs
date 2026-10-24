const { chromium } = require('playwright');
const path = require('path');
const url = (f) => 'file:///' + path.resolve(__dirname, f).replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await page.goto(url('v3-cards.html'));
  await page.waitForTimeout(600);
  await page.click('#dataBtn3');
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.width)]; };
    return {
      vw: innerWidth,
      docScroll: document.documentElement.scrollWidth,
      bodyScroll: document.body.scrollWidth,
      overlay: box(q('.pf-overlay.on')),
      head: box(q('.pf-overlay.on .pf-overlay-head, .pf-overlay.on header')),
      body: box(q('.pf-overlay.on .pf-overlay-body')),
      pfex: box(q('#dataFeat3 .pf-ex')),
      tools: box(q('#dataFeat3 .pf-ex-tools')),
      searchBox: box(q('#dataFeat3 .pf-ex-search')),
      list: box(q('#dataFeat3 .pf-ex-list')),
      item: box(q('#dataFeat3 .pf-ex-item')),
      mapbox: box(q('#dataFeat3 .pf-ex-mapbox')),
      map: box(q('#dataFeat3 .pf-ex-map')),
      panel: box(q('#dataFeat3')),
      boxSizing: getComputedStyle(q('#dataFeat3 .pf-ex-search')).boxSizing,
      app: box(q('.app')),
      appW: getComputedStyle(q('.app')).width,
      overflowX: getComputedStyle(document.body).overflowX,
    };
  });
  console.log(JSON.stringify(m, null, 2));
  await browser.close();
})();
