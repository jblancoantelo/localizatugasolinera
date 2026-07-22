import { readFileSync, writeFileSync } from 'fs';
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
