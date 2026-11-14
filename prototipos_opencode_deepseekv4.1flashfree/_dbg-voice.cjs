const { chromium } = require('playwright');
const path = require('path');
const RAIL = 'file:///' + __dirname.replace(/\\/g, '/') + '/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(RAIL + 'v6-drive.html?embed=1&theme=dark');
  await p.waitForTimeout(600);
  await p.click('#voiceBtn');
  await p.waitForTimeout(1800);
  const info = await p.evaluate(() => {
    const sh = document.getElementById('voiceSheet');
    const btn = document.getElementById('voiceUse');
    const r = btn.getBoundingClientRect();
    const cs = getComputedStyle(sh);
    return { cls: sh.className, transform: cs.transform, vh: innerHeight, btn: { top: r.top, bottom: r.bottom }, disabled: btn.disabled, bodyH: sh.querySelector('.sheet-body')?.getBoundingClientRect().height };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
