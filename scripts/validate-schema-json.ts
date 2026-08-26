#!/usr/bin/env tsx
/**
 * Validates a hand-authored layout or bin design JSON file.
 *
 * Two legs, reported separately:
 *   1. JSON Schema  — structure, types, enums, ranges. Precise paths.
 *   2. Real importer — the cross-field rules JSON Schema cannot express:
 *      bin placement and collisions, compartment cell counts, layer references.
 *
 * A file is only safe to import when BOTH pass. Schema-only validation would
 * bless a file that the app then rejects.
 *
 * Usage: pnpm run validate:json <file-or-directory>...
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateImport } from '../src/shared/utils/validation.ts';
import { hasOversizedMeshAsset } from '../src/shared/generation/meshAsset.ts';
import { validateImportedBinParams } from '../src/features/bin-designer/utils/designJson.ts';
import type { DocumentFormat } from './schema/loadSchemas.ts';
import { createValidators, detectFormat, formatErrors } from './schema/loadSchemas.ts';

interface Report {
  readonly file: string;
  readonly format: DocumentFormat | null;
  readonly schemaErrors: string[];
  readonly importerErrors: string[];
  readonly fatal?: string;
}

/**
 * Renders an i18n key as readable text. The designer validator speaks through
 * `t`, and booting the locale bundle for a dev CLI is not worth it; the schema
 * leg already carries the precise messages.
 */
const t = ((key: string, params?: Record<string, unknown>) => {
  const leaf = key.split('.').pop() ?? key;
  return params && Object.keys(params).length > 0 ? `${leaf} ${JSON.stringify(params)}` : leaf;
}) as unknown as Parameters<typeof validateImportedBinParams>[1];

function collectFiles(target: string): string[] {
  if (!statSync(target).isDirectory()) return [target];
  const out: string[] = [];
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const full = join(target, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out.sort();
}

const validators = createValidators();

function validateFile(file: string): Report {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch (error) {
    return {
      file,
      format: null,
      schemaErrors: [],
      importerErrors: [],
      fatal: `not valid JSON: ${(error as Error).message}`,
    };
  }

  const format = detectFormat(doc);
  if (format === null) {
    return {
      file,
      format: null,
      schemaErrors: [],
      importerErrors: [],
      fatal:
        'could not tell which format this is. A bin design needs "type": "gridfinity-bin-design"; a layout needs drawer, layers and bins.',
    };
  }

  const validate = format === 'layout' ? validators.layout : validators.binDesign;
  const schemaErrors = validate(doc) ? [] : formatErrors(validate.errors);

  const importerErrors: string[] = [];
  if (format === 'layout') {
    const result = validateImport(doc);
    if (!result.valid) importerErrors.push(...result.errors);

    // The schema leg already validates every embedded design against BinParams
    // via the layout schema's $ref, so re-checking it here would report the same
    // error twice and file the second copy under the wrong leg. What the schema
    // cannot express is the asset budget: `restoreEmbeddedDesigns` silently
    // DROPS a design whose mesh assets are oversized, so a file that imports
    // "successfully" can arrive with bins pointing at nothing.
    const linked = (doc as { linkedDesigns?: unknown }).linkedDesigns;
    if (Array.isArray(linked)) {
      linked.forEach((entry, i) => {
        if (hasOversizedMeshAsset((entry as { params?: unknown }).params)) {
          importerErrors.push(
            `linkedDesigns[${i}] exceeds the mesh asset budget and would be dropped on import`
          );
        }
      });
    }
  } else {
    const result = validateImportedBinParams((doc as { params?: unknown }).params, t);
    if (!result.valid) importerErrors.push(...result.errors);
  }

  return { file, format, schemaErrors, importerErrors };
}

function print(report: Report): boolean {
  const name = relative(process.cwd(), report.file) || report.file;
  if (report.fatal !== undefined) {
    console.error(`✗ ${name}\n    ${report.fatal}`);
    return false;
  }
  const failed = report.schemaErrors.length > 0 || report.importerErrors.length > 0;
  if (!failed) {
    console.log(`✓ ${name} (${report.format})`);
    return true;
  }
  console.error(`✗ ${name} (${report.format})`);
  if (report.schemaErrors.length > 0) {
    console.error('  schema:');
    for (const error of report.schemaErrors) console.error(`    ${error}`);
  }
  if (report.importerErrors.length > 0) {
    console.error('  importer:');
    for (const error of report.importerErrors) console.error(`    ${error}`);
  }
  return false;
}

function main(): void {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('Usage: pnpm run validate:json <file-or-directory>...');
    process.exit(2);
  }

  const files = targets.flatMap(collectFiles);
  if (files.length === 0) {
    console.error('No .json files found in the given paths.');
    process.exit(2);
  }

  let allPassed = true;
  for (const file of files) {
    if (!print(validateFile(file))) allPassed = false;
  }

  if (!allPassed) {
    console.error(`\n${files.length} file(s) checked, at least one failed.`);
    process.exit(1);
  }
  console.log(`\n${files.length} file(s) checked, all valid.`);
}

main();
