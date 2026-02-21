/* eslint-disable no-console -- Build script uses console for status output */
/**
 * Generates en.json from en.ts for lazy-loaded runtime use.
 *
 * en.ts is the source of truth (has comments, sections, TypeScript types).
 * en.json is the generated runtime artifact (lazy-loaded like other locales).
 *
 * Usage: npx tsx scripts/build-en-locale.ts
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = join(process.cwd(), 'src', 'i18n', 'locales');

async function main() {
  // Dynamic import to get the default export from the TS module
  const en = (await import(join(LOCALES_DIR, 'en.ts'))).default;
  const json = JSON.stringify(en, null, 2) + '\n';
  writeFileSync(join(LOCALES_DIR, 'en.json'), json);
  console.log(`✓ Generated en.json (${Object.keys(en).length} keys)`);
}

void main();
