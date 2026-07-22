import { readFileSync, writeFileSync } from 'fs';
const sw = readFileSync('sw.js', 'utf8');
const match = sw.match(/const APP_VERSION\s*=\s*(\d+);/);
if (!match) { console.error('ERROR: APP_VERSION not found in sw.js'); process.exit(1); }
const current = parseInt(match[1]);
const next = current + 1;
const result = sw.replace(match[0], `const APP_VERSION = ${next};`);
writeFileSync('sw.js', result);
console.log(`APP_VERSION: ${current} → ${next}`);
