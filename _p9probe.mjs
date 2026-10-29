import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const url = pathToFileURL(path.resolve('prototipos_opencode_bigpickle/prototipo9-coste-real/index.html')).href;
const errs = [];
const ok = [];
const bad = [];
function check(nombre, cond, extra = '') {
  (cond ? ok : bad).push(nombre + (extra ? ' → ' + extra : ''));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));
await page.goto(url);
await page.waitForTimeout(300);

const ls0 = await page.evaluate(() => { try { return Object.keys(localStorage); } catch (e) { return ['ERR:' + e.message]; } });
console.log('localStorage inicial:', ls0);

// --- decisión inicial
const hero = await page.locator('.hero-nombre').textContent();
const heroTotal = await page.locator('.hero-total strong').textContent();
console.log('Héroe:', hero, heroTotal);
check('héroe con ganadora', !!hero);
check('aviso educativo (compara con la más barata por litro)', await page.locator('.aviso-cambio').count() === 1);

// --- litros recalculan
await page.click('.btn-paso[data-paso="5"]');
await page.waitForTimeout(80);
const heroTotal2 = await page.locator('.hero-total strong').textContent();
check('stepper de litros recalcula total', heroTotal !== heroTotal2, heroTotal + ' → ' + heroTotal2);
check('input litros = 55', await page.inputValue('#litros') === '55');

// --- provincia
const nMadrid = await page.locator('.alt').count();
await page.selectOption('#selProv', '08');
await page.waitForTimeout(120);
const provTxt = await page.locator('#mapaSub').textContent().catch(() => '');
const locOpts = await page.locator('#selLocalidad option').count();
check('cambio de provincia actualiza localidades', locOpts > 1, locOpts + ' opciones');
await page.selectOption('#selProv', '28');
await page.waitForTimeout(120);

// --- combustible
await page.selectOption('#selFuel', 'Gasóleo A');
await page.waitForTimeout(100);
const heroFuel = await page.locator('.hero-nombre').textContent();
check('cambio de combustible recalcula', !!heroFuel, heroFuel);
await page.selectOption('#selFuel', 'Gasolina 95 E5');
await page.waitForTimeout(100);

// --- localidad
const locs = await page.locator('#selLocalidad option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
await page.selectOption('#selLocalidad', locs[0]);
await page.waitForTimeout(100);
check('filtro localidad aplica', await page.locator('#btnLimpiar').isVisible());
await page.click('#btnLimpiar');
await page.waitForTimeout(100);

// --- marcas
await page.click('#btnMarcas');
await page.waitForTimeout(80);
const marcas = await page.locator('#marcasLista [data-marca]').count();
await page.locator('#marcasLista [data-marca]').nth(0).check();
await page.locator('#marcasLista [data-marca]').nth(1).check();
await page.click('#marcaAplicar');
await page.waitForTimeout(120);
const cuenta = await page.locator('#marcasCuenta').textContent();
check('filtro de marcas aplica 2', cuenta === '2', marcas + ' marcas · contador ' + cuenta);
await page.click('#btnLimpiar');
await page.waitForTimeout(100);

// --- búsqueda
await page.click('#btnBuscar');
await page.fill('#buscar', 'getafe');
await page.waitForTimeout(150);
const heroBusqueda = await page.locator('.hero').count();
check('búsqueda filtra (héroe o vacío)', heroBusqueda === 1 || await page.locator('.vacio').count() === 1);
await page.fill('#buscar', 'zzzznoexiste');
await page.waitForTimeout(120);
check('estado vacío con búsqueda sin resultados', await page.locator('.vacio').count() === 1);
await page.click('#btnLimpiar');
await page.waitForTimeout(120);
check('limpiar cierra la fila de búsqueda', await page.locator('#buscadorFila').isHidden());

// --- favoritas
await page.click('label[for="chkFav"]');
await page.waitForTimeout(100);
const favHero = await page.locator('.hero').count();
check('solo favoritas deja resultados', favHero === 1);
await page.click('label[for="chkFav"]');
await page.waitForTimeout(100);

// --- radio
await page.locator('#radio').evaluate(el => { el.value = '3'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(120);
const radioTxt = await page.locator('#radioVal').textContent();
check('slider de radio actualiza etiqueta', radioTxt.includes('3'), radioTxt);
await page.click('#btnLimpiar');
await page.waitForTimeout(120);

// --- lista + orden + paginación
await page.click('.nav-pc [data-vista="lista"]');
await page.waitForTimeout(120);
const filasPag = await page.locator('#tablaCuerpo tr').count();
console.log('filas por defecto:', filasPag);
await page.selectOption('#pageSizeSel', '5');
await page.waitForTimeout(120);
const filas5 = await page.locator('#tablaCuerpo tr').count();
check('paginación a 5 filas', filas5 === 5, String(filas5));
const pag1 = await page.locator('#pagInfo').textContent();
await page.click('#pagNext');
await page.waitForTimeout(100);
const pag2 = await page.locator('#pagInfo').textContent();
check('página siguiente cambia el rango', pag1 !== pag2, pag1.trim() + ' → ' + pag2.trim());
await page.selectOption('#ordenSel', 'precio-desc');
await page.waitForTimeout(100);
const primeraFilaDesc = await page.locator('#tablaCuerpo tr').first().textContent();
await page.selectOption('#ordenSel', 'coste');
await page.waitForTimeout(100);
const primeraFilaCoste = await page.locator('#tablaCuerpo tr').first().textContent();
check('orden por coste difiere de precio', primeraFilaDesc !== primeraFilaCoste);
const subLista = await page.locator('#listaSub').textContent();
check('lista indica coste desde', /coste desde/.test(subLista), subLista);
await page.selectOption('#pageSizeSel', '10');
await page.waitForTimeout(100);

// --- ficha
await page.click('#tablaCuerpo tr:first-child [data-ficha]');
await page.waitForTimeout(250);
check('ficha abierta', await page.locator('#ficha').isVisible());
const nombreFicha = await page.locator('#fichaNombre').textContent();
const pts = await page.evaluate(() => (document.querySelector('#grafica')._pts || []).length);
check('gráfica dibujada con puntos', pts >= 2, pts + ' puntos · ' + nombreFicha);
// tooltip
const box = await page.locator('#grafica').boundingBox();
if (box && pts) {
  const pt = await page.evaluate(() => document.querySelector('#grafica')._pts[1]);
  await page.mouse.move(box.x + pt.x, box.y + pt.y);
  await page.waitForTimeout(150);
  const tipVis = await page.locator('#graficaTip').isVisible();
  const tipTxt = await page.locator('#graficaTip').textContent();
  check('tooltip de la gráfica', tipVis && /\d,\d{3}/.test(tipTxt), tipTxt.trim());
}
// favorito desde ficha
const favAntes = await page.locator('#fichaFav').getAttribute('aria-pressed');
await page.click('#fichaFav');
await page.waitForTimeout(120);
const favDespues = await page.locator('#fichaFav').getAttribute('aria-pressed');
check('favorito conmuta desde la ficha', favAntes !== favDespues, favAntes + ' → ' + favDespues);
// cambiar combustible y periodo
const fuelsFicha = await page.locator('#fichaFuel option').count();
if (fuelsFicha > 1) {
  await page.selectOption('#fichaFuel', { index: 1 });
  await page.waitForTimeout(120);
}
await page.selectOption('#fichaDias', '90');
await page.waitForTimeout(150);
const pts90 = await page.evaluate(() => (document.querySelector('#grafica')._pts || []).length);
check('periodo de 90 días redibuja', pts90 > 0, pts90 + ' puntos');
await page.click('#fichaCerrar');
await page.waitForTimeout(100);

// --- IA
await page.click('.nav-pc [data-vista="ia"]');
await page.waitForTimeout(120);
const pills = await page.locator('.ia-pill').count();
check('8 pestañas de IA', pills === 8, String(pills));
await page.fill('#iaInput', '¿Dónde reposto con 50 litros?');
await page.click('#iaEnviar');
await page.waitForTimeout(1100);
const metaTxt = await page.locator('.ia-msg-meta').last().textContent();
check('respuesta IA con marca de agua', /⏱/.test(metaTxt), metaTxt);
await page.click('.ia-pill[data-iaprov="groq"]');
await page.waitForTimeout(100);
await page.click('.ia-pill[data-iaprov="general"]');
await page.waitForTimeout(120);
check('marca de agua sobrevive al cambiar de pestaña', await page.locator('.ia-msg-meta').count() >= 1);
check('markdown renderizado (tabla o negrita)', await page.locator('.ia-msg.assistant .ia-md-table, .ia-msg.assistant strong').count() > 0);

// --- ajustes y descuentos
await page.click('.nav-pc [data-vista="config"]');
await page.waitForTimeout(150);
const descVal = await page.locator('[data-desc="Repsol"]').inputValue();
check('descuento con punto decimal en el input', descVal === '0.05', descVal);
await page.fill('[data-desc="Repsol"]', '0.2');
await page.waitForTimeout(150);
await page.click('.nav-pc [data-vista="decision"]');
await page.waitForTimeout(150);
const razones = await page.locator('.hero-razones').textContent();
check('descuento aplicado en la decisión', /0,200/.test(razones), razones.slice(0, 120));
check('bloques de ajustes', await page.locator('.ajustes > .tarjeta').count() === 8, String(await page.locator('.ajustes > .tarjeta').count()));

// --- persistencia: dejar estado reconocible
await page.selectOption('#selProv', '08');
await page.waitForTimeout(150);
await page.click('#btnBuscar');
await page.fill('#buscar', 'centre');
await page.waitForTimeout(200);
await page.locator('#litros').evaluate(el => { el.value = '70'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(400);

const guardado = await page.evaluate(() => { try { return localStorage.getItem('gasolineras_proto9_estado'); } catch (e) { return 'ERR:' + e.message; } });
console.log('estado guardado:', guardado && guardado.slice(0, 240));
check('estado persistido en localStorage', typeof guardado === 'string' && guardado.includes('"prov":"08"'));

await page.reload();
await page.waitForTimeout(500);
const trasF5 = {
  prov: await page.inputValue('#selProv'),
  texto: await page.inputValue('#buscar'),
  litros: await page.inputValue('#litros'),
  buscadorAbierto: await page.locator('#buscadorFila').isVisible(),
  vista: await page.locator('.nav-pc [data-vista][aria-selected="true"]').textContent()
};
console.log('tras F5:', trasF5);
check('F5 conserva provincia', trasF5.prov === '08');
check('F5 conserva búsqueda', trasF5.texto === 'centre');
check('F5 reabre la fila de búsqueda', trasF5.buscadorAbierto);
check('F5 conserva litros', trasF5.litros === '70');

// --- descuentos persistidos (la tarjeta de ajustes solo se pinta al abrirla)
await page.click('.nav-pc [data-vista="config"]');
await page.waitForTimeout(250);
const descF5 = await page.locator('[data-desc="Repsol"]').inputValue();
check('F5 conserva descuentos', descF5 === '0.20', descF5);
await page.click('.nav-pc [data-vista="ia"]');
await page.waitForTimeout(200);

// --- IA persiste tras F5
await page.click('.nav-pc [data-vista="ia"]');
await page.waitForTimeout(300);
check('chat IA persiste tras F5', await page.locator('.ia-msg.assistant').count() >= 1);
check('marca de agua persiste tras F5', await page.locator('.ia-msg-meta').count() >= 1);

// --- borrar datos guardados
await page.click('.nav-pc [data-vista="config"]');
await page.waitForTimeout(150);
await page.click('#btnOlvidar');
await page.waitForTimeout(1200);
const trasOlvidar = await page.evaluate(() => { try { return Object.keys(localStorage).filter(k => k.startsWith('gasolineras_proto9')); } catch (e) { return ['ERR']; } });
check('borrar datos guardados limpia localStorage y recarga', trasOlvidar.length === 0, JSON.stringify(trasOlvidar));
check('estado de fábrica tras borrar', await page.inputValue('#selProv') === '28' && await page.inputValue('#litros') === '50');

console.log('\nOK (' + ok.length + '):');
ok.forEach(o => console.log('  ✔', o));
console.log('\nFALLOS (' + bad.length + '):');
bad.forEach(b => console.log('  ✘', b));
console.log('\nErrores de consola:', errs.length ? errs : 'ninguno');
await browser.close();
if (bad.length || errs.length) process.exit(1);
