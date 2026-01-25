/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Pre-commit check: Verify all locale JSON files have the same keys as en.ts.
 *
 * Usage: npx tsx scripts/check-i18n-keys.ts
 * Exit code 0 = all locales match, 1 = mismatches found
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LOCALES_DIR = join(import.meta.dirname, '..', 'src', 'i18n', 'locales');

// Parse en.ts to extract keys (regex-based to avoid import side effects)
function getEnglishKeys(): string[] {
  const content = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  const keys: string[] = [];
  // Match lines like: 'key.name': 'value', or 'key.name': "value",
  // Also handles multi-line values where the value is on the next line
  const regex = /^\s*'([^']+)':\s*['"\n]/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys.sort();
}

// Get keys from a JSON locale file
function getJsonKeys(filename: string): string[] {
  const content = readFileSync(join(LOCALES_DIR, filename), 'utf-8');
  const data = JSON.parse(content) as Record<string, string>;
  return Object.keys(data).sort();
}

// Find locale JSON files
function getLocaleFiles(): string[] {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

// Main check
const enKeys = getEnglishKeys();
const localeFiles = getLocaleFiles();
let hasErrors = false;

console.log(`\n📋 English (en.ts): ${enKeys.length} keys`);
console.log(`📁 Locale files: ${localeFiles.join(', ')}\n`);

for (const file of localeFiles) {
  const jsonKeys = getJsonKeys(file);
  const missing = enKeys.filter((k) => !jsonKeys.includes(k));
  const extra = jsonKeys.filter((k) => !enKeys.includes(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`✅ ${file}: ${jsonKeys.length} keys (matches en.ts)`);
  } else {
    hasErrors = true;
    console.log(`❌ ${file}: ${jsonKeys.length} keys`);
    if (missing.length > 0) {
      console.log(`   Missing ${missing.length} key(s):`);
      missing.forEach((k) => console.log(`     - ${k}`));
    }
    if (extra.length > 0) {
      console.log(`   Extra ${extra.length} key(s) (not in en.ts):`);
      extra.forEach((k) => console.log(`     + ${k}`));
    }
  }
}

console.log('');

if (hasErrors) {
  console.error(
    '❌ i18n key mismatch detected. All locale files must have the same keys as en.ts.'
  );
  process.exit(1);
} else {
  console.log('✅ All locale files have matching keys.');
  process.exit(0);
}
