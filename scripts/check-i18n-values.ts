/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Pre-commit check: Detect locale values identical to English (untranslated placeholders).
 *
 * Usage: npx tsx scripts/check-i18n-values.ts
 * Exit code 0 = all values translated, 1 = untranslated values found
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const LOCALES_DIR = join(import.meta.dirname, '..', 'src', 'i18n', 'locales');
const ALLOWLIST_PATH = join(import.meta.dirname, 'i18n-values-allowlist.json');

export interface Allowlist {
  maxShortValueLength: number;
  keys: string[];
  valuePatterns: string[];
}

export interface UntranslatedEntry {
  key: string;
  value: string;
}

// Parse en.ts to extract key-value pairs (regex-based to avoid import side effects)
export function getEnglishTranslations(content: string): Map<string, string> {
  const translations = new Map<string, string>();

  // Match key-value pairs: 'key.name': 'value' or 'key.name': "value"
  const singleQuoteRegex = /'([^']+)':\s*'([^']*)'/g;
  const doubleQuoteRegex = /'([^']+)':\s*"([^"]*)"/g;

  let match;
  while ((match = singleQuoteRegex.exec(content)) !== null) {
    translations.set(match[1], match[2]);
  }
  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    translations.set(match[1], match[2]);
  }

  return translations;
}

// Get key-value pairs from a JSON locale file
export function getLocaleTranslations(content: string): Map<string, string> {
  try {
    const data = JSON.parse(content) as Record<string, string>;
    return new Map(Object.entries(data));
  } catch {
    throw new Error('Failed to parse locale JSON');
  }
}

// Load allowlist config from JSON file
export function loadAllowlist(content: string): Allowlist {
  try {
    return JSON.parse(content) as Allowlist;
  } catch {
    throw new Error('Failed to parse allowlist JSON');
  }
}

// Check if a key-value pair is allowed to be identical to English
export function isAllowedIdentical(key: string, value: string, allowlist: Allowlist): boolean {
  // 1. Explicit key allowlist
  if (allowlist.keys.includes(key)) {
    return true;
  }

  // 2. Short values without spaces (e.g., "OK", "3MF", "9+")
  if (value.length <= allowlist.maxShortValueLength && value.length > 0 && !value.includes(' ')) {
    return true;
  }

  // 3. Value matches an allowed pattern
  for (const pattern of allowlist.valuePatterns) {
    if (new RegExp(pattern).test(value)) {
      return true;
    }
  }

  return false;
}

// Find locale values that are identical to English and not allowlisted
export function findUntranslatedValues(
  enTranslations: Map<string, string>,
  localeTranslations: Map<string, string>,
  allowlist: Allowlist
): UntranslatedEntry[] {
  const untranslated: UntranslatedEntry[] = [];

  for (const [key, localeValue] of localeTranslations) {
    const enValue = enTranslations.get(key);

    // Skip keys not in English (caught by check-i18n-keys)
    if (enValue === undefined) {
      continue;
    }

    // Skip empty values
    if (enValue === '' || localeValue === '') {
      continue;
    }

    // Check if values are identical
    if (enValue === localeValue && !isAllowedIdentical(key, localeValue, allowlist)) {
      untranslated.push({ key, value: localeValue });
    }
  }

  return untranslated.sort((a, b) => a.key.localeCompare(b.key));
}

// Find locale JSON files (en.json is generated from en.ts, so skip it)
function getLocaleFiles(): string[] {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .sort();
}

// Main execution (only when run directly, not when imported for testing)
const isDirectExecution = process.argv[1]?.endsWith('check-i18n-values.ts');

if (isDirectExecution) {
  const enContent = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  const enTranslations = getEnglishTranslations(enContent);
  const allowlistContent = readFileSync(ALLOWLIST_PATH, 'utf-8');
  const allowlist = loadAllowlist(allowlistContent);
  const localeFiles = getLocaleFiles();
  let hasErrors = false;

  console.log(`\n🔍 Checking for untranslated values (identical to English)...\n`);
  console.log(`📋 English (en.ts): ${enTranslations.size} keys`);
  console.log(`📁 Locale files: ${localeFiles.join(', ')}`);
  console.log(
    `📝 Allowlist: ${allowlist.keys.length} keys, ${allowlist.valuePatterns.length} patterns, max short length: ${allowlist.maxShortValueLength}\n`
  );

  for (const file of localeFiles) {
    const localeContent = readFileSync(join(LOCALES_DIR, file), 'utf-8');
    const localeTranslations = getLocaleTranslations(localeContent);
    const untranslated = findUntranslatedValues(enTranslations, localeTranslations, allowlist);

    if (untranslated.length === 0) {
      console.log(`✅ ${file}: all values translated`);
    } else {
      hasErrors = true;
      console.log(`❌ ${file}: ${untranslated.length} untranslated value(s)`);
      for (const { key, value } of untranslated) {
        const displayValue = value.length > 60 ? value.slice(0, 57) + '...' : value;
        console.log(`     ${key} => ${JSON.stringify(displayValue)}`);
      }
    }
  }

  console.log('');

  if (hasErrors) {
    console.error(
      '❌ Untranslated values detected. Translate the flagged keys or add them to scripts/i18n-values-allowlist.json.'
    );
    process.exit(1);
  } else {
    console.log('✅ All locale values are translated (or allowlisted).');
    process.exit(0);
  }
}
