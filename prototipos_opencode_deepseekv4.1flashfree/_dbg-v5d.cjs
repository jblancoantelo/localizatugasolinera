const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const http = require('http');
const srv = http.createServer((req, res) => {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
  const p = decodeURIComponent(req.url.split('?')[0]);
  fs.readFile(path.join(ROOT, p), (err, data) => {
    if (err) { res.writeHead(404); res.end(''); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'text/plain' });
    res.end(data);
  });
});
srv.listen(8896, '127.0.0.1', async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('http://127.0.0.1:8896/prototipos_opencode_deepseekv4.1flashfree/v5-ia.html?embed=1');
  await page.waitForTimeout(300);
  await page.fill('#ask', '¿dónde reposto más barato?');
  await page.click('#sendBtn');
  await page.waitForTimeout(12000);
  const out = await page.evaluate(() => [...document.querySelectorAll('.msg.assistant')].map(m => {
    const b = m.querySelector('.bubble');
    return b ? b.innerHTML.replace(/<span class="caret"><\/span>/, '[CARET]') : '(sin bubble)';
  }));
  out.forEach((h, i) => console.log('--- msg ' + i + ' ---\n' + h + '\n'));
  await browser.close();
  srv.close();
});
