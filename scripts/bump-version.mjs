import { readFileSync, writeFileSync } from 'fs';
import { syncAssets } from './sync-sw-assets.mjs';

// La lista de assets del SW se regenera antes de subir la versión: si se ha
// añadido un script, se ha añadido también al precaché (y al revés).
const assets = syncAssets();
console.log(assets.changed
  ? 'ASSETS de sw.js sincronizados con index.html (' + assets.count + ' ficheros)'
  : 'ASSETS de sw.js ya sincronizados (' + assets.count + ' ficheros)');

const sw = readFileSync('sw.js', 'utf8');
const match = sw.match(/const APP_VERSION\s*=\s*(\d+);/);
if (!match) { console.error('ERROR: APP_VERSION not found in sw.js'); process.exit(1); }
const current = parseInt(match[1]);
const next = current + 1;
const now = new Date();
const year = now.getFullYear().toString();
const mon = (now.getMonth()+1).toString().padStart(2,'0');
const day = now.getDate().toString().padStart(2,'0');
const hh = now.getHours().toString().padStart(2,'0');
const mm = now.getMinutes().toString().padStart(2,'0');
const ss = now.getSeconds().toString().padStart(2,'0');
const buildTime = `${year}${mon}${day}-${hh}${mm}${ss}`;
let result = sw.replace(match[0], `const APP_VERSION = ${next};`);
const timeMatch = sw.match(/const BUILD_TIME\s*=\s*'[^']+';/);
if (timeMatch) {
  result = result.replace(timeMatch[0], `const BUILD_TIME = '${buildTime}';`);
} else {
  result = result.replace('const APP_VERSION = ' + next + ';', 'const APP_VERSION = ' + next + ';\nconst BUILD_TIME = \'' + buildTime + '\';');
}
writeFileSync('sw.js', result);
console.log(`APP_VERSION: ${current} → ${next}, BUILD_TIME: ${buildTime}`);

// Chrome (sobre todo en Android) reutiliza el bitmap del icono cacheado por
// URL: si el manifest cambia el contenido pero las URLs de los iconos son las
// mismas, el lanzador se queda con la imagen antigua. Se les añade la versión
// como query para que cada release sea un recurso distinto y se descargue
// fresco. sync-sw-assets.mjs y el test de build recortan el `?v=`, así que
// el precaché del SW sigue apuntando al fichero sin query (el fetch con query
// salta la caché del SW y va directo a la red, que es justo lo que se quiere).
const manifestPath = 'manifest.json';
const manifest = readFileSync(manifestPath, 'utf8');
const versioned = manifest.replace(/"src":\s*"(icons\/[^"?]+)(?:\?[^"]*)?"/g, `"src": "$1?v=${next}"`);
if (versioned !== manifest) {
  writeFileSync(manifestPath, versioned);
  console.log(`manifest.json: iconos con ?v=${next}`);
} else {
  console.log('manifest.json: sin iconos que versionar');
}

