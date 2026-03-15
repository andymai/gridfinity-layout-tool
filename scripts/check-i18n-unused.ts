/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Detect translation keys in en.ts that are never referenced in source code.
 *
 * Detects keys referenced via:
 *   - t('key') and getStaticTranslation('key') calls
 *   - Data structures: labelKey: 'key', descriptionKey: 'key', etc.
 *   - String arrays: ['key1', 'key2'] as const
 *   - Any string literal matching a known translation key
 *
 * Handles dynamic keys (e.g. t(`prefix.${var}`)) via prefix detection so
 * they are reported as "possibly unused" rather than "definitely unused".
 *
 * Usage: pnpm exec tsx scripts/check-i18n-unused.ts
 * Exit code 0 = no definitely-unused keys, 1 = unused keys found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const LOCALES_DIR = join(ROOT_DIR, 'src', 'i18n', 'locales');
const SRC_DIR = join(ROOT_DIR, 'src');

// ---------------------------------------------------------------------------
// 1. Parse en.ts to extract all keys
// ---------------------------------------------------------------------------
export function getEnglishKeys(): string[] {
  const content = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  return extractKeysFromSource(content);
}

/** Regex-based key extraction (no import side effects). */
export function extractKeysFromSource(content: string): string[] {
  const keys: string[] = [];
  const regex = /^\s*'([^']+)':\s*['"\n]/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  return keys.sort();
}

// ---------------------------------------------------------------------------
// 2. Recursively collect source files
// ---------------------------------------------------------------------------
export function getSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'locales' || entry === 'test') continue;
      files.push(...getSourceFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      if (entry.endsWith('.d.ts')) continue;
      if (entry.includes('.test.') || entry.includes('.spec.')) continue;
      files.push(fullPath);
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// 3. Extract referenced keys & dynamic prefixes from source files
// ---------------------------------------------------------------------------

export interface KeyUsage {
  /** Keys found as string literals anywhere in source code */
  literalKeys: Set<string>;
  /** Prefixes from dynamic calls like t(`prefix.${var}`) */
  dynamicPrefixes: Set<string>;
}

/**
 * Extract all translation key references from a single file's content.
 *
 * Uses a two-pronged approach:
 * 1. Match any single/double-quoted string literal that exactly matches a known key
 * 2. Match dynamic template-literal prefixes from t() and getStaticTranslation()
 */
export function extractKeyReferences(content: string, knownKeys?: Set<string>): KeyUsage {
  const literalKeys = new Set<string>();
  const dynamicPrefixes = new Set<string>();

  // Strategy 1: Match t('key') and getStaticTranslation('key') — always works
  const tCallRegex = /(?:\bt|getStaticTranslation)\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = tCallRegex.exec(content)) !== null) {
    literalKeys.add(match[1]);
  }

  // Strategy 2: If we have the full key set, find any string literal matching a known key.
  // This catches keys stored in data structures (labelKey, descriptionKey, arrays, etc.)
  if (knownKeys && knownKeys.size > 0) {
    const stringLiteralRegex = /['"]([a-zA-Z0-9][a-zA-Z0-9]*(?:\.[a-zA-Z0-9][a-zA-Z0-9]*)+)['"]/g;
    while ((match = stringLiteralRegex.exec(content)) !== null) {
      if (knownKeys.has(match[1])) {
        literalKeys.add(match[1]);
      }
    }
  }

  // Strategy 3: Match dynamic keys — t(`prefix.${...}`) or getStaticTranslation(`prefix.${...}`)
  const dynamicRegex = /(?:\bt|getStaticTranslation)\(\s*`([^$`]+)\$\{/g;
  while ((match = dynamicRegex.exec(content)) !== null) {
    dynamicPrefixes.add(match[1]);
  }

  return { literalKeys, dynamicPrefixes };
}

/** Scan all source files and merge key usage. */
export function collectAllKeyUsage(sourceFiles: string[], knownKeys?: Set<string>): KeyUsage {
  const combined: KeyUsage = {
    literalKeys: new Set<string>(),
    dynamicPrefixes: new Set<string>(),
  };

  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf-8');
    const usage = extractKeyReferences(content, knownKeys);
    for (const k of usage.literalKeys) combined.literalKeys.add(k);
    for (const p of usage.dynamicPrefixes) combined.dynamicPrefixes.add(p);
  }

  return combined;
}

// ---------------------------------------------------------------------------
// 4. Classify unused keys
// ---------------------------------------------------------------------------

export interface UnusedKeyReport {
  /** Keys with no literal reference AND no matching dynamic prefix */
  definitelyUnused: string[];
  /** Keys with no literal reference but covered by a dynamic prefix */
  possiblyUnused: string[];
}

export function classifyUnusedKeys(allKeys: string[], usage: KeyUsage): UnusedKeyReport {
  const definitelyUnused: string[] = [];
  const possiblyUnused: string[] = [];
  const prefixArray = [...usage.dynamicPrefixes];

  for (const key of allKeys) {
    if (usage.literalKeys.has(key)) continue;

    const coveredByDynamic = prefixArray.some((prefix) => key.startsWith(prefix));

    if (coveredByDynamic) {
      possiblyUnused.push(key);
    } else {
      definitelyUnused.push(key);
    }
  }

  return { definitelyUnused, possiblyUnused };
}

// ---------------------------------------------------------------------------
// 5. Main (only runs when executed directly, not when imported for tests)
// ---------------------------------------------------------------------------

function main(): void {
  console.log('\n🔍 Checking for unused i18n keys...\n');

  const allKeys = getEnglishKeys();
  const knownKeys = new Set(allKeys);
  console.log(`📋 English (en.ts): ${allKeys.length} keys`);

  const sourceFiles = getSourceFiles(SRC_DIR);
  console.log(`📁 Scanning ${sourceFiles.length} source files...\n`);

  const usage = collectAllKeyUsage(sourceFiles, knownKeys);
  console.log(`   Literal key references: ${usage.literalKeys.size}`);
  console.log(`   Dynamic prefixes: ${[...usage.dynamicPrefixes].join(', ') || '(none)'}\n`);

  const report = classifyUnusedKeys(allKeys, usage);

  if (report.definitelyUnused.length > 0) {
    console.log(`❌ ${report.definitelyUnused.length} definitely-unused key(s):`);
    for (const key of report.definitelyUnused) {
      console.log(`   - ${key}`);
    }
    console.log('');
  }

  if (report.possiblyUnused.length > 0) {
    console.log(
      `⚠️  ${report.possiblyUnused.length} possibly-unused key(s) (covered by dynamic prefix):`
    );
    for (const key of report.possiblyUnused) {
      console.log(`   ~ ${key}`);
    }
    console.log('');
  }

  if (report.definitelyUnused.length === 0 && report.possiblyUnused.length === 0) {
    console.log('✅ All keys are referenced in source code.\n');
  }

  if (report.definitelyUnused.length > 0) {
    console.error('❌ Unused i18n keys detected. Remove them or add references.\n');
    process.exit(1);
  }

  console.log('✅ No definitely-unused keys found.\n');
  process.exit(0);
}

// Run main only when executed as a script (not when imported in tests)
const isDirectExecution = process.argv[1]?.endsWith('check-i18n-unused.ts');
if (isDirectExecution) {
  main();
}
