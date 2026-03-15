/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Safety-checked i18n key consolidation helper.
 *
 * Given --from old.key --to common.key, this script:
 * 1. Verifies both keys exist in en.ts
 * 2. Checks ALL locale JSON files have identical values for both keys
 * 3. If safe: removes old key from en.ts + all JSON files
 * 4. Lists source files referencing the old key (for manual code update)
 *
 * Usage: pnpm exec tsx scripts/consolidate-i18n-key.ts --from old.key --to common.key [--dry-run]
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const LOCALES_DIR = join(ROOT_DIR, 'src', 'i18n', 'locales');
const SRC_DIR = join(ROOT_DIR, 'src');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------
function parseArgs(): { from: string; to: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let from = '';
  let to = '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      from = args[++i];
    } else if (args[i] === '--to' && args[i + 1]) {
      to = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  if (!from || !to) {
    console.error(
      'Usage: pnpm exec tsx scripts/consolidate-i18n-key.ts --from old.key --to new.key [--dry-run]'
    );
    process.exit(1);
  }

  return { from, to, dryRun };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getEnglishTranslations(): Map<string, string> {
  const content = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  const translations = new Map<string, string>();
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

function getLocaleFiles(): string[] {
  return readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'en.json')
    .sort();
}

function getJsonTranslations(filename: string): Record<string, string> {
  const content = readFileSync(join(LOCALES_DIR, filename), 'utf-8');
  try {
    return JSON.parse(content) as Record<string, string>;
  } catch {
    console.error(`❌ Failed to parse ${filename}`);
    process.exit(1);
  }
}

/** Escape all regex special characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findSourceReferences(key: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`['"]${escapeRegex(key)}['"]`);

  function scanDir(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'locales') continue;
        scanDir(fullPath);
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        if (entry.endsWith('.d.ts')) continue;
        const content = readFileSync(fullPath, 'utf-8');
        if (regex.test(content)) {
          results.push(fullPath.replace(ROOT_DIR + '/', ''));
        }
      }
    }
  }

  scanDir(SRC_DIR);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const { from, to, dryRun } = parseArgs();

console.log(`\n🔄 Consolidating i18n key: '${from}' → '${to}'${dryRun ? ' (DRY RUN)' : ''}\n`);

// Step 1: Verify both keys exist in en.ts
const enTranslations = getEnglishTranslations();

if (!enTranslations.has(from)) {
  console.error(`❌ Source key '${from}' not found in en.ts`);
  process.exit(1);
}
if (!enTranslations.has(to)) {
  console.error(`❌ Target key '${to}' not found in en.ts`);
  process.exit(1);
}

const enFromValue = enTranslations.get(from);
const enToValue = enTranslations.get(to);

if (enFromValue !== enToValue) {
  console.error(`❌ English values differ:`);
  console.error(`   '${from}' = "${enFromValue}"`);
  console.error(`   '${to}'   = "${enToValue}"`);
  process.exit(1);
}

console.log(`✅ English values match: "${enFromValue}"`);

// Step 2: Check all locale JSON files
const localeFiles = getLocaleFiles();
let allMatch = true;

for (const file of localeFiles) {
  const translations = getJsonTranslations(file);
  const fromValue = translations[from];
  const toValue = translations[to];

  if (fromValue === undefined) {
    console.error(`❌ ${file}: '${from}' not found`);
    allMatch = false;
  } else if (toValue === undefined) {
    console.error(`❌ ${file}: '${to}' not found`);
    allMatch = false;
  } else if (fromValue !== toValue) {
    console.error(`❌ ${file}: values differ`);
    console.error(`   '${from}' = "${fromValue}"`);
    console.error(`   '${to}'   = "${toValue}"`);
    allMatch = false;
  } else {
    console.log(`✅ ${file}: values match ("${fromValue}")`);
  }
}

if (!allMatch) {
  console.error('\n❌ Cannot consolidate: locale values differ. Fix translations first.\n');
  process.exit(1);
}

// Step 3: Remove old key from locale files
if (!dryRun) {
  // Remove from en.ts
  const enContent = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  const lineRegex = new RegExp(`^\\s*'${escapeRegex(from)}':\\s*.+\\n`, 'gm');
  const newEnContent = enContent.replace(lineRegex, '');
  writeFileSync(join(LOCALES_DIR, 'en.ts'), newEnContent);
  console.log(`\n📝 Removed '${from}' from en.ts`);

  // Remove from JSON files
  for (const file of localeFiles) {
    const translations = getJsonTranslations(file);
    const filtered = Object.fromEntries(
      Object.entries(translations).filter(([key]) => key !== from)
    );
    const sortedKeys = Object.keys(filtered).sort();
    writeFileSync(join(LOCALES_DIR, file), JSON.stringify(filtered, sortedKeys, 2) + '\n');
    console.log(`📝 Removed '${from}' from ${file}`);
  }
}

// Step 4: List source files referencing old key
const references = findSourceReferences(from);
if (references.length > 0) {
  console.log(`\n📋 Source files referencing '${from}' (update manually):`);
  for (const ref of references) {
    console.log(`   ${ref}`);
  }
} else {
  console.log(`\n✅ No source files reference '${from}'`);
}

console.log(dryRun ? '\n🔍 Dry run complete. No files modified.\n' : '\n✅ Done!\n');
