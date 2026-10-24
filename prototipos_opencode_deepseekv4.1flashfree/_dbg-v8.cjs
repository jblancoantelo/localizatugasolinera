const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const url = 'file:///' + path.resolve(__dirname, 'v8-plan.html').replace(/\\/g, '/');
  await page.goto(url);
  await page.waitForTimeout(600);
  const sels = ['#heroTitle8', '#planCta8', '#ctaTxt8', '.v8-chart-card h2', '.v8-week-card h2', '.v8-hero-copy p', '.v8-price'];
  for (const sel of sels) {
    const info = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const c = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim().slice(0, 40),
        font: c.fontFamily, size: c.fontSize, weight: c.fontWeight, style: c.fontStyle,
        line: c.lineHeight, color: c.color, w: Math.round(r.width), h: Math.round(r.height),
      };
    }, sel);
    console.log(sel, info);
  }
  await page.screenshot({ path: path.join(__dirname, 'capturas', '_dbg-v8.png') });
  await browser.close();
})();
