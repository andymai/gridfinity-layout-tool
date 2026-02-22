/* eslint-disable no-console -- CLI script that outputs to console */
/**
 * Pre-commit check: Verify translation interpolation placeholders match code usage.
 *
 * This script detects:
 * 1. Translation calls that pass params but the string doesn't use them
 * 2. Translation strings with placeholders that are never called with params
 *
 * Usage: npx tsx scripts/check-i18n-interpolation.ts
 * Exit code 0 = all interpolations match, 1 = mismatches found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const LOCALES_DIR = join(ROOT_DIR, 'src', 'i18n', 'locales');
const SRC_DIR = join(ROOT_DIR, 'src');

interface TranslationString {
  key: string;
  value: string;
  placeholders: string[];
}

interface TranslationCall {
  key: string;
  params: string[];
  file: string;
  line: number;
}

interface Mismatch {
  key: string;
  stringPlaceholders: string[];
  codeParams: string[];
  file: string;
  line: number;
  type: 'unused-params' | 'missing-placeholders' | 'no-params';
}

// Remove ICU blocks from a string by counting braces
function removeIcuBlocks(value: string): string {
  let result = '';
  let i = 0;

  while (i < value.length) {
    // Check if this is the start of an ICU block: {varname, plural/select/selectordinal
    if (value[i] === '{') {
      const icuMatch = value
        .slice(i)
        .match(/^\{([a-zA-Z_][a-zA-Z0-9_]*),\s*(plural|select|selectordinal)/);
      if (icuMatch) {
        // This is an ICU block - find the matching closing brace
        let depth = 1;
        let j = i + 1;
        while (j < value.length && depth > 0) {
          if (value[j] === '{') depth++;
          else if (value[j] === '}') depth--;
          j++;
        }
        // Skip the entire ICU block
        i = j;
        continue;
      }
    }
    result += value[i];
    i++;
  }

  return result;
}

// Extract placeholders from a translation string (e.g., {count}, {name})
// Also handles ICU message format like {count, plural, one {person} other {people}}
function extractPlaceholders(value: string): string[] {
  const placeholders: string[] = [];

  // First, extract ICU format variable names: {count, plural, ...} or {name, select, ...}
  // We need to do this BEFORE removing ICU blocks to capture the variable name
  const icuMatches = value.match(/\{([a-zA-Z_][a-zA-Z0-9_]*),\s*(plural|select|selectordinal)/g);
  if (icuMatches) {
    for (const m of icuMatches) {
      const varName = m.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (varName) {
        placeholders.push(varName[1]);
      }
    }
  }

  // Remove ICU blocks to avoid extracting literal text (like {person}, {people}) as placeholders
  const cleanValue = removeIcuBlocks(value);

  // Match simple placeholders: {name} from the cleaned string
  const simpleMatches = cleanValue.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
  if (simpleMatches) {
    for (const m of simpleMatches) {
      placeholders.push(m.slice(1, -1));
    }
  }

  return [...new Set(placeholders)].sort();
}

// Parse en.ts to extract keys, values, and their placeholders
function getTranslationStrings(): Map<string, TranslationString> {
  const content = readFileSync(join(LOCALES_DIR, 'en.ts'), 'utf-8');
  const translations = new Map<string, TranslationString>();

  // Match key-value pairs with single-quoted values: 'key.name': 'value',
  const singleQuoteRegex = /'([^']+)':\s*'([^']*)'/g;
  // Match key-value pairs with double-quoted values: 'key.name': "value",
  const doubleQuoteRegex = /'([^']+)':\s*"([^"]*)"/g;

  let match;

  while ((match = singleQuoteRegex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];
    const placeholders = extractPlaceholders(value);
    translations.set(key, { key, value, placeholders });
  }

  while ((match = doubleQuoteRegex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];
    const placeholders = extractPlaceholders(value);
    translations.set(key, { key, value, placeholders });
  }

  return translations;
}

// Recursively get all TypeScript/TSX files
function getSourceFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, test files, and locale files
      if (entry === 'node_modules' || entry === 'test' || entry === 'locales') {
        continue;
      }
      files.push(...getSourceFiles(fullPath));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      // Skip test files and type definition files
      if (entry.includes('.test.') || entry.endsWith('.d.ts')) {
        continue;
      }
      files.push(fullPath);
    }
  }

  return files;
}

// Find matching closing brace, handling nested braces and template literals
function findMatchingBrace(content: string, startIndex: number): number {
  let depth = 1;
  let i = startIndex;
  let inTemplate = false;
  let inString: string | null = null;

  while (i < content.length && depth > 0) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // Handle escape sequences
    if (prevChar === '\\') {
      i++;
      continue;
    }

    // Handle string literals
    if (!inTemplate && (char === '"' || char === "'" || char === '`')) {
      if (inString === char) {
        inString = null;
      } else if (!inString) {
        inString = char;
        if (char === '`') inTemplate = true;
      }
      i++;
      continue;
    }

    // Handle template literal interpolation
    if (inTemplate && char === '$' && content[i + 1] === '{') {
      // Skip the ${...} part - find its matching }
      i += 2;
      let templateDepth = 1;
      while (i < content.length && templateDepth > 0) {
        if (content[i] === '{') templateDepth++;
        else if (content[i] === '}') templateDepth--;
        i++;
      }
      continue;
    }

    if (inTemplate && char === '`') {
      inTemplate = false;
      inString = null;
      i++;
      continue;
    }

    // Skip if inside a string
    if (inString) {
      i++;
      continue;
    }

    // Count braces
    if (char === '{') depth++;
    else if (char === '}') depth--;

    i++;
  }

  return depth === 0 ? i - 1 : -1;
}

// Extract translation calls from source code
function extractTranslationCalls(filePath: string): TranslationCall[] {
  const content = readFileSync(filePath, 'utf-8');
  const calls: TranslationCall[] = [];

  // Find t('key', { and getStaticTranslation('key', { — use brace matching for the params object
  const callStartRegex = /\b(?:t|getStaticTranslation)\(\s*['"]([^'"]+)['"]\s*,\s*\{/g;

  let match;
  while ((match = callStartRegex.exec(content)) !== null) {
    const key = match[1];
    const braceStart = match.index + match[0].length - 1; // Position of opening {
    const braceEnd = findMatchingBrace(content, braceStart + 1);

    if (braceEnd === -1) continue; // No matching brace found

    const paramsStr = content.slice(braceStart + 1, braceEnd);
    const matchLine = content.slice(0, match.index).split('\n').length;

    // Extract param names: handles { count }, { count: 5 }, { count, name }, { count: x, name: y }
    const params: string[] = [];
    for (const part of paramsStr.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const propMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s*:|(?=\s*$))/);
      if (propMatch) params.push(propMatch[1]);
    }

    if (params.length > 0) {
      calls.push({
        key,
        params: [...new Set(params)].sort(), // Remove duplicates
        file: relative(ROOT_DIR, filePath),
        line: matchLine,
      });
    }
  }

  return calls;
}

// Find mismatches between translation strings and code usage
function findMismatches(
  translations: Map<string, TranslationString>,
  calls: TranslationCall[]
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  for (const call of calls) {
    const translation = translations.get(call.key);

    if (!translation) {
      // Key not found in translations - this is caught by the other script
      continue;
    }

    const stringPlaceholders = translation.placeholders;
    const codeParams = call.params;

    // Check for params passed but not used in string
    const unusedParams = codeParams.filter((p) => !stringPlaceholders.includes(p));
    if (unusedParams.length > 0) {
      mismatches.push({
        key: call.key,
        stringPlaceholders,
        codeParams,
        file: call.file,
        line: call.line,
        type: 'unused-params',
      });
    }

    // Check for placeholders in string but not passed in code
    // Note: We only flag this if some params ARE being passed but not all
    // (calling t('key') without params for a string with placeholders is ok - might be intentional)
    if (codeParams.length > 0) {
      const missingParams = stringPlaceholders.filter((p) => !codeParams.includes(p));
      if (missingParams.length > 0) {
        mismatches.push({
          key: call.key,
          stringPlaceholders,
          codeParams,
          file: call.file,
          line: call.line,
          type: 'missing-placeholders',
        });
      }
    }
  }

  return mismatches;
}

// Find t('key') / getStaticTranslation('key') calls with NO params where the string has placeholders.
// These would render placeholder tokens like {count} literally in the UI.
function findZeroParamCalls(
  sourceFiles: string[],
  translations: Map<string, TranslationString>
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  // Matches t('key') or getStaticTranslation('key') with no second argument
  const noParamsRegex = /\b(?:t|getStaticTranslation)\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const filePath of sourceFiles) {
    const content = readFileSync(filePath, 'utf-8');
    let match;
    noParamsRegex.lastIndex = 0;
    while ((match = noParamsRegex.exec(content)) !== null) {
      const key = match[1];
      const translation = translations.get(key);
      if (!translation || translation.placeholders.length === 0) continue;
      const line = content.slice(0, match.index).split('\n').length;
      mismatches.push({
        key,
        stringPlaceholders: translation.placeholders,
        codeParams: [],
        file: relative(ROOT_DIR, filePath),
        line,
        type: 'no-params',
      });
    }
  }

  return mismatches;
}

// Main execution
console.log('\n🔍 Checking i18n interpolation placeholders...\n');

const translations = getTranslationStrings();
console.log(`📋 Found ${translations.size} translation strings in en.ts`);

// Count strings with placeholders
const stringsWithPlaceholders = [...translations.values()].filter((t) => t.placeholders.length > 0);
console.log(`   └─ ${stringsWithPlaceholders.length} strings have interpolation placeholders`);

const sourceFiles = getSourceFiles(SRC_DIR);
console.log(`\n📁 Scanning ${sourceFiles.length} source files for t() calls...`);

const allCalls: TranslationCall[] = [];
for (const file of sourceFiles) {
  const calls = extractTranslationCalls(file);
  allCalls.push(...calls);
}

console.log(`   └─ Found ${allCalls.length} translation calls with parameters\n`);

const mismatches = [
  ...findMismatches(translations, allCalls),
  ...findZeroParamCalls(sourceFiles, translations),
];

if (mismatches.length === 0) {
  console.log('✅ All interpolation placeholders match code usage.\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${mismatches.length} interpolation mismatch(es):\n`);

  // Group by type
  const unusedParams = mismatches.filter((m) => m.type === 'unused-params');
  const missingPlaceholders = mismatches.filter((m) => m.type === 'missing-placeholders');
  const noParams = mismatches.filter((m) => m.type === 'no-params');

  if (unusedParams.length > 0) {
    console.log('⚠️  Params passed but not used in translation string:');
    console.log("   (Code passes params that the translation string doesn't use)\n");
    for (const m of unusedParams) {
      const unused = m.codeParams.filter((p) => !m.stringPlaceholders.includes(p));
      console.log(`   ${m.file}:${m.line}`);
      console.log(`     Key: ${m.key}`);
      console.log(`     Unused params: ${unused.join(', ')}`);
      console.log(
        `     String placeholders: ${m.stringPlaceholders.length > 0 ? m.stringPlaceholders.join(', ') : '(none)'}`
      );
      console.log('');
    }
  }

  if (missingPlaceholders.length > 0) {
    console.log('⚠️  String placeholders not passed in code:');
    console.log("   (Translation string expects params that code doesn't provide)\n");
    for (const m of missingPlaceholders) {
      const missing = m.stringPlaceholders.filter((p) => !m.codeParams.includes(p));
      console.log(`   ${m.file}:${m.line}`);
      console.log(`     Key: ${m.key}`);
      console.log(`     Missing params: ${missing.join(', ')}`);
      console.log(`     Code provides: ${m.codeParams.join(', ')}`);
      console.log('');
    }
  }

  if (noParams.length > 0) {
    console.log('⚠️  Strings with placeholders called without any params:');
    console.log('   (Placeholder tokens like {count} will render literally in the UI)\n');
    for (const m of noParams) {
      console.log(`   ${m.file}:${m.line}`);
      console.log(`     Key: ${m.key}`);
      console.log(`     Expected params: ${m.stringPlaceholders.join(', ')}`);
      console.log('');
    }
  }

  console.error(
    '❌ i18n interpolation mismatch detected. Fix the translation strings or code usage.\n'
  );
  process.exit(1);
}
