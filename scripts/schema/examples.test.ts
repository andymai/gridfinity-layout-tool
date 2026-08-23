/**
 * Golden example round-trip.
 *
 * Valid examples must pass the schema AND the real runtime importers, so a
 * file the docs teach you to write is proven to actually import. Invalid
 * examples are filed by the layer that should reject them:
 *
 * - `invalid/schema/`   must be rejected by the JSON Schema.
 * - `invalid/importer/` must PASS the schema and be rejected by the importer.
 *   These are the cross-field rules JSON Schema cannot express, so the
 *   directory doubles as proof that schema validation alone is not enough.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateImport } from '@/shared/utils/validation';
import { validateImportedBinParams } from '@/features/bin-designer/utils/designJson';
import { createValidators, detectFormat, formatErrors } from './loadSchemas';

const EXAMPLES_DIR = join(process.cwd(), 'docs/schemas/examples');

/**
 * `validateImportedBinParams` renders user-facing errors through i18n. The
 * examples only assert pass/fail, so a stub that echoes the key is enough and
 * avoids booting the locale bundle.
 */
const t = ((key: string) => key) as unknown as Parameters<typeof validateImportedBinParams>[1];

const { layout: validateLayoutSchema, binDesign: validateBinDesignSchema } = createValidators();

function read(...segments: string[]): { raw: string; parsed: unknown } {
  const raw = readFileSync(join(EXAMPLES_DIR, ...segments), 'utf8');
  return { raw, parsed: JSON.parse(raw) as unknown };
}

function listJson(...segments: string[]): string[] {
  return readdirSync(join(EXAMPLES_DIR, ...segments))
    .filter((f) => f.endsWith('.json'))
    .sort();
}

/** Same classifier the CLI uses, so the two can never disagree about routing. */
const isLayout = (parsed: unknown): boolean => detectFormat(parsed) === 'layout';

function checkSchema(_file: string, parsed: unknown): { ok: boolean; errors: string[] } {
  const validate = isLayout(parsed) ? validateLayoutSchema : validateBinDesignSchema;
  const ok = validate(parsed) as boolean;
  return { ok, errors: formatErrors(validate.errors) };
}

/** The runtime leg: whichever real importer owns this document type. */
function checkImporter(_file: string, parsed: unknown): { ok: boolean; errors: string[] } {
  if (isLayout(parsed)) {
    const result = validateImport(parsed);
    return { ok: result.valid, errors: result.valid ? [] : [...result.errors] };
  }
  const params = (parsed as { params?: unknown }).params;
  const result = validateImportedBinParams(params, t);
  return { ok: result.valid, errors: [...result.errors] };
}

describe('valid examples', () => {
  const files = listJson();

  it('there are examples for both formats', () => {
    const formats = files.map((f) => detectFormat(read(f).parsed));
    expect(formats).toContain('layout');
    expect(formats).toContain('bin-design');
  });

  it.each(files)('%s passes the schema', (file) => {
    const { parsed } = read(file);
    const { ok, errors } = checkSchema(file, parsed);
    expect(ok, `${file} failed schema validation:\n  ${errors.join('\n  ')}`).toBe(true);
  });

  it.each(files)('%s passes the real importer', (file) => {
    const { parsed } = read(file);
    const { ok, errors } = checkImporter(file, parsed);
    expect(ok, `${file} failed import validation:\n  ${errors.join('\n  ')}`).toBe(true);
  });

  it.each(files.filter((f) => isLayout(read(f).parsed)))(
    '%s embeds designs that validate as BinParams',
    (file) => {
      const { parsed } = read(file);
      const linked = (parsed as { linkedDesigns?: unknown }).linkedDesigns;
      if (!Array.isArray(linked)) return;
      const { binParams } = createValidators();
      for (const entry of linked) {
        const params = (entry as { params?: unknown }).params;
        const ok = binParams(params) as boolean;
        expect(
          ok,
          `${file} linkedDesigns entry invalid:\n  ${formatErrors(binParams.errors).join('\n  ')}`
        ).toBe(true);
      }
    }
  );
});

describe('invalid examples rejected by the schema', () => {
  it.each(listJson('invalid', 'schema'))('%s', (file) => {
    const { parsed } = read('invalid', 'schema', file);
    const { ok } = checkSchema(file, parsed);
    expect(ok, `${file} was accepted by the schema but should have been rejected`).toBe(false);
  });
});

describe('invalid examples the schema cannot catch', () => {
  const files = listJson('invalid', 'importer');

  it.each(files)('%s passes the schema', (file) => {
    const { parsed } = read('invalid', 'importer', file);
    const { ok, errors } = checkSchema(file, parsed);
    expect(
      ok,
      `${file} is filed as an importer-only failure but the schema rejected it:\n  ${errors.join('\n  ')}\nMove it to invalid/schema/ if the schema is meant to catch it.`
    ).toBe(true);
  });

  it.each(files)('%s is rejected by the real importer', (file) => {
    const { parsed } = read('invalid', 'importer', file);
    const { ok } = checkImporter(file, parsed);
    expect(ok, `${file} was accepted by the importer but should have been rejected`).toBe(false);
  });
});
