import fs from 'fs';
import { parse } from 'acorn';

const files = [
  'js/push-notifications.js',
  'js/state.js',
  'sw.js'
];

for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    parse(content, { sourceType: 'module', ecmaVersion: 'latest' });
    console.log(`✓ ${file} - syntax OK`);
  } catch (e) {
    console.log(`✗ ${file} - ERROR: ${e.message}`);
  }
}
