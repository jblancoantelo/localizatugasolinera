import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";
const url = pathToFileURL(path.resolve("prototipos_opencode_bigpickle/prototipo9-coste-real/index.html")).href;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(url);
await p.waitForTimeout(250);
for (const litros of [5, 10, 20, 50, 100]) {
  await p.evaluate(l => { const el = document.querySelector("#litros"); el.value = String(l); el.dispatchEvent(new Event("input", { bubbles: true })); }, litros);
  await p.waitForTimeout(120);
  const info = await p.evaluate(() => {
    const h = document.querySelector(".hero-nombre")?.textContent;
    const av = document.querySelector(".aviso-cambio")?.textContent.trim();
    return { h, av };
  });
  console.log(litros + " L →", info.h, "|", info.av);
}
await b.close();
