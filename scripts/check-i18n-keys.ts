/**
 * Pre-commit check: Verify all locale JSON files have the same keys as en.ts.
 *
 * Plural families (`key_one`, `key_few`, ...) are compared by their base key
 * instead: each locale must define the forms its own language reaches for
 * whole numbers, which differ from English's `_one` / `_other`.
 *
 * Usage: pnpm exec tsx scripts/check-i18n-keys.ts
 * Exit code 0 = all locales match, 1 = mismatches found
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  allowedPluralCategories,
  pluralBase,
  requiredPluralCategories,
} from '../src/i18n/plural.ts';

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

// Find locale JSON files (en.json is generated from en.ts, so skip it)
function getLocaleFiles(): string[] {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .sort();
}

/** Bases of the plural families English defines (those with an `_other` form). */
function pluralFamilies(keys: string[]): Set<string> {
  return new Set(keys.filter((k) => k.endsWith('_other')).map((k) => pluralBase(k) ?? k));
}

/** Missing and extra keys for one locale, plural families compared per language. */
function compareKeys(
  locale: string,
  enKeys: string[],
  keys: string[],
  families: Set<string>
): { missing: string[]; extra: string[] } {
  const isFamilyKey = (k: string) => {
    const base = pluralBase(k);
    return base !== null && families.has(base);
  };
  const plainEn = enKeys.filter((k) => !isFamilyKey(k));
  const plainLocale = keys.filter((k) => !isFamilyKey(k));
  const missing = plainEn.filter((k) => !plainLocale.includes(k));
  const extra = plainLocale.filter((k) => !plainEn.includes(k));

  const required = requiredPluralCategories(locale);
  const allowed = allowedPluralCategories(locale);
  for (const base of families) {
    for (const category of required) {
      if (!keys.includes(`${base}_${category}`)) missing.push(`${base}_${category}`);
    }
  }
  for (const k of keys) {
    const base = pluralBase(k);
    if (base === null || !families.has(base)) continue;
    const category = k.slice(base.length + 1);
    if (!allowed.some((c) => c === category)) extra.push(k);
  }
  return { missing: missing.sort(), extra: extra.sort() };
}

// Main check
const enKeys = getEnglishKeys();
const families = pluralFamilies(enKeys);
const localeFiles = getLocaleFiles();
let hasErrors = false;

console.log(`\n📋 English (en.ts): ${enKeys.length} keys, ${families.size} plural families`);
console.log(`📁 Locale files: ${localeFiles.join(', ')}\n`);

const enCheck = compareKeys('en', enKeys, enKeys, families);
if (enCheck.missing.length > 0 || enCheck.extra.length > 0) {
  hasErrors = true;
  console.log(`❌ en.ts: plural families must use exactly English's forms:`);
  enCheck.missing.forEach((k) => console.log(`     - ${k}`));
  enCheck.extra.forEach((k) => console.log(`     + ${k}`));
}

for (const file of localeFiles) {
  const jsonKeys = getJsonKeys(file);
  const { missing, extra } = compareKeys(file.replace(/\.json$/, ''), enKeys, jsonKeys, families);

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
