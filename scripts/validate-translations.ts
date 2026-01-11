/**
 * Translation validation script
 *
 * Validates:
 * 1. All translation files have valid JSON
 * 2. All locales have the same keys (no missing translations)
 * 3. No empty translation values
 * 4. ICU message format validity (basic check)
 *
 * Usage:
 *   npx tsx scripts/validate-translations.ts           # Full validation
 *   npx tsx scripts/validate-translations.ts --syntax-only  # JSON syntax only (for local dev)
 */

import fs from 'fs';
import path from 'path';

const syntaxOnly = process.argv.includes('--syntax-only');

const LOCALES_DIR = path.join(process.cwd(), 'src/i18n/locales');
const NAMESPACES = [
  'common',
  'layout',
  'validation',
  'toast',
  'share',
  'print',
  'help',
  'aria',
] as const;

interface ValidationError {
  locale: string;
  namespace: string;
  key?: string;
  message: string;
}

interface TranslationData {
  [key: string]: string | TranslationData;
}

const errors: ValidationError[] = [];
const warnings: ValidationError[] = [];

/**
 * Recursively extract all keys from a translation object
 */
function extractKeys(obj: TranslationData, prefix = ''): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      keys.push(fullKey);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...extractKeys(value, fullKey));
    }
  }

  return keys.sort();
}

/**
 * Get value at a nested key path
 */
function getNestedValue(
  obj: TranslationData,
  keyPath: string
): string | undefined {
  const parts = keyPath.split('.');
  let current: TranslationData | string | undefined = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Validate ICU message format (basic check)
 */
function validateICUFormat(value: string, key: string): string | null {
  // Check for unbalanced braces
  let braceCount = 0;
  for (const char of value) {
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (braceCount < 0) {
      return `Unbalanced braces in "${key}"`;
    }
  }
  if (braceCount !== 0) {
    return `Unbalanced braces in "${key}"`;
  }

  // Check for common ICU patterns
  const icuPattern = /\{(\w+)(?:,\s*(\w+)(?:,\s*(.+?))?)?\}/g;
  let match;
  while ((match = icuPattern.exec(value)) !== null) {
    const [, , type] = match;
    if (type && !['plural', 'select', 'selectordinal', 'number', 'date', 'time'].includes(type)) {
      return `Unknown ICU format type "${type}" in "${key}"`;
    }
  }

  return null;
}

/**
 * Load and validate a single translation file
 */
function loadTranslationFile(
  locale: string,
  namespace: string
): TranslationData | null {
  const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);

  if (!fs.existsSync(filePath)) {
    errors.push({
      locale,
      namespace,
      message: `Missing translation file: ${namespace}.json`,
    });
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as TranslationData;
  } catch (e) {
    errors.push({
      locale,
      namespace,
      message: `Invalid JSON in ${namespace}.json: ${e instanceof Error ? e.message : 'Unknown error'}`,
    });
    return null;
  }
}

/**
 * Validate translation values
 */
function validateValues(
  data: TranslationData,
  locale: string,
  namespace: string,
  prefix = ''
): void {
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      // Check for empty values
      if (value.trim() === '') {
        warnings.push({
          locale,
          namespace,
          key: fullKey,
          message: `Empty translation value`,
        });
      }

      // Validate ICU format
      const icuError = validateICUFormat(value, fullKey);
      if (icuError) {
        errors.push({
          locale,
          namespace,
          key: fullKey,
          message: icuError,
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      validateValues(value, locale, namespace, fullKey);
    }
  }
}

/**
 * Compare keys between locales
 */
function compareLocaleKeys(
  baseLocale: string,
  baseKeys: Map<string, string[]>,
  targetLocale: string,
  targetKeys: Map<string, string[]>
): void {
  for (const namespace of NAMESPACES) {
    const base = baseKeys.get(namespace) || [];
    const target = targetKeys.get(namespace) || [];

    // Find missing keys in target
    for (const key of base) {
      if (!target.includes(key)) {
        errors.push({
          locale: targetLocale,
          namespace,
          key,
          message: `Missing translation (exists in ${baseLocale})`,
        });
      }
    }

    // Find extra keys in target (might be intentional, so just warn)
    for (const key of target) {
      if (!base.includes(key)) {
        warnings.push({
          locale: targetLocale,
          namespace,
          key,
          message: `Extra key not in ${baseLocale} (might be unused)`,
        });
      }
    }
  }
}

/**
 * Validate JSON syntax only (for local development)
 */
function validateSyntaxOnly(): boolean {
  console.log('🔍 Validating JSON syntax...\n');

  const locales = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  let hasErrors = false;

  for (const locale of locales) {
    for (const namespace of NAMESPACES) {
      const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          JSON.parse(content);
        } catch (e) {
          console.error(`❌ ${locale}/${namespace}.json: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
          hasErrors = true;
        }
      }
    }
  }

  if (!hasErrors) {
    console.log('✅ All JSON files have valid syntax!\n');
  }

  return !hasErrors;
}

/**
 * Main validation function (full validation)
 */
function validate(): boolean {
  console.log('🔍 Validating translations...\n');

  // Get all locales
  const locales = fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (locales.length === 0) {
    console.error('❌ No locale directories found');
    process.exit(1);
  }

  console.log(`📁 Found locales: ${locales.join(', ')}\n`);

  // Load all translations and extract keys
  const allKeys = new Map<string, Map<string, string[]>>();
  const allData = new Map<string, Map<string, TranslationData>>();

  for (const locale of locales) {
    const localeKeys = new Map<string, string[]>();
    const localeData = new Map<string, TranslationData>();

    for (const namespace of NAMESPACES) {
      const data = loadTranslationFile(locale, namespace);
      if (data) {
        localeData.set(namespace, data);
        localeKeys.set(namespace, extractKeys(data));
        validateValues(data, locale, namespace);
      }
    }

    allKeys.set(locale, localeKeys);
    allData.set(locale, localeData);
  }

  // Compare keys between locales (use 'en' as base)
  const baseLocale = 'en';
  const baseKeys = allKeys.get(baseLocale);

  if (!baseKeys) {
    console.error('❌ Base locale (en) not found');
    process.exit(1);
  }

  for (const locale of locales) {
    if (locale !== baseLocale) {
      const targetKeys = allKeys.get(locale);
      if (targetKeys) {
        compareLocaleKeys(baseLocale, baseKeys, locale, targetKeys);
      }
    }
  }

  // Print summary
  console.log('📊 Summary:\n');

  let totalKeys = 0;
  for (const namespace of NAMESPACES) {
    const keys = baseKeys.get(namespace) || [];
    totalKeys += keys.length;
    console.log(`   ${namespace}: ${keys.length} keys`);
  }
  console.log(`   ─────────────────`);
  console.log(`   Total: ${totalKeys} keys\n`);

  // Print warnings
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s):\n`);
    for (const warning of warnings) {
      const location = warning.key
        ? `${warning.locale}/${warning.namespace}:${warning.key}`
        : `${warning.locale}/${warning.namespace}`;
      console.log(`   ${location}: ${warning.message}`);
    }
    console.log();
  }

  // Print errors
  if (errors.length > 0) {
    console.log(`❌ ${errors.length} error(s):\n`);
    for (const error of errors) {
      const location = error.key
        ? `${error.locale}/${error.namespace}:${error.key}`
        : `${error.locale}/${error.namespace}`;
      console.log(`   ${location}: ${error.message}`);
    }
    console.log();
    return false;
  }

  console.log('✅ All translations valid!\n');
  return true;
}

// Run validation
const isValid = syntaxOnly ? validateSyntaxOnly() : validate();
process.exit(isValid ? 0 : 1);
