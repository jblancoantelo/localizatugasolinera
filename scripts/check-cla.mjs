// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Juan Blanco Antelo — Localiza tu Gasolinera

// Comprueba si un usuario de GitHub ha firmado el CLA del proyecto.
//
// Uso:
//   node scripts/check-cla.mjs <usuario-github>              → 0 firmado, 1 sin firmar
//   node scripts/check-cla.mjs <usuario-github> --file ruta  → usa otro registro (CI)
//   node scripts/check-cla.mjs --list                        → lista las firmas
//
// Lo usa .github/workflows/cla.yml y también sirve en local antes de fusionar
// una PR de alguien de fuera.
import { readFileSync } from 'fs';

const DEFAULT_FILE = 'docs/legal/CLA-firmas.json';
const args = process.argv.slice(2);

const fileIdx = args.indexOf('--file');
const file = fileIdx >= 0 ? args[fileIdx + 1] : DEFAULT_FILE;
if (fileIdx >= 0 && !file) fail('--file necesita una ruta');
// Descarta las opciones y el valor de --file para quedarnos con el login.
const positional = args.filter((a, i) => !a.startsWith('--') && (fileIdx < 0 || i !== fileIdx + 1));

function fail(msg) {
  console.error('ERROR: ' + msg);
  process.exit(2);
}

let registro;
try {
  registro = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  fail('no se puede leer el registro de firmas "' + file + '": ' + e.message);
}

const firmas = Array.isArray(registro.firmas) ? registro.firmas : [];
const normaliza = s => String(s || '').trim().toLowerCase().replace(/^@/, '');

if (args.includes('--list')) {
  console.log('CLA v' + (registro.cla || '?') + ' — ' + firmas.length + ' firma(s) en ' + file);
  for (const f of firmas) {
    const extra = f.tipo === 'corporativa' ? ' (empresa: ' + (f.empresa || '?') + ')' : '';
    console.log('  · @' + (f.github || '?') + ' — ' + (f.nombre || 'sin nombre') + ' · ' + (f.fecha || 'sin fecha') + extra);
  }
  process.exit(0);
}

const login = normaliza(positional[0]);
if (!login) fail('falta el usuario de GitHub. Uso: node scripts/check-cla.mjs <usuario>');

const firma = firmas.find(f => normaliza(f.github) === login);
if (firma) {
  console.log('✓ @' + login + ' ha firmado el CLA v' + (firma.cla || registro.cla || '?') + ' (' + (firma.fecha || 'sin fecha') + ')');
  process.exit(0);
}

console.log('✗ @' + login + ' NO aparece en ' + file);
process.exit(1);
