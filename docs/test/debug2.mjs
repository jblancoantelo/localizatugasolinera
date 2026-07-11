import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8082;

function startServer() {
  return new Promise((resolve) => {
    const types = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json'
    };
    const srv = http.createServer((req, res) => {
      let u = req.url.split('?')[0];
      let p = u === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, u);
      fs.readFile(p, (err, d) => {
        if (err) { res.writeHead(404); res.end(''); }
        else { res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); }
      });
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

async function test() {
  const srv = await startServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  let errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log(`[ERROR] ${msg.text()}`);
    }
  });

  console.log('Loading page...');
  try {
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 30000 });
  } catch(e) {
    console.log('Navigation error:', e.message);
  }

  await page.waitForTimeout(2000);

  const contentArea = await page.locator('#contentArea');
  const classList = await contentArea.evaluate(el => Array.from(el.classList));
  console.log('contentArea classes:', classList);

  const noProv = await page.locator('#noProvinceMsg');
  const isVis = await noProv.isVisible().catch(() => false);
  console.log('#noProvinceMsg isVisible:', isVis);

  const display = await noProv.evaluate(el => getComputedStyle(el).display).catch(e => 'ERROR');
  console.log('#noProvinceMsg display style:', display);

  const h2 = await page.locator('#noProvinceMsg h2');
  const text = await h2.textContent().catch(() => 'N/A');
  console.log('#noProvinceMsg h2 text:', text);

  console.log('Console errors:', errors.length > 0 ? errors : 'NONE');

  await browser.close();
  srv.close();
}

test().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
