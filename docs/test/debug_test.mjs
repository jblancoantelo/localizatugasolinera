import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const PORT = 8081;

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

  console.log('Loading page...');
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});

  await page.waitForTimeout(2000);

  const noProv = await page.locator('#noProvinceMsg').isVisible().catch(() => false);
  console.log('noProvinceMsg visible:', noProv);

  const display = await page.locator('#noProvinceMsg').evaluate(el => getComputedStyle(el).display).catch(e => 'ERROR: ' + e.message);
  console.log('noProvinceMsg display:', display);

  const content = await page.locator('#noProvinceMsg').textContent().catch(() => 'N/A');
  console.log('noProvinceMsg text:', content?.slice(0, 50));

  await browser.close();
  srv.close();
}

test().catch(console.error);
