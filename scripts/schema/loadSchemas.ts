/**
 * Loads the published JSON Schemas and builds an ajv validator for them.
 *
 * Shared by the drift tests and by `pnpm run validate:json`, so the CLI and CI
 * can never disagree about what the schemas say.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// The default `ajv` entry only knows draft-07; the schemas declare 2020-12.
import Ajv from 'ajv/dist/2020';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export const SCHEMA_DIR = join(process.cwd(), 'public/schema');

export const LAYOUT_SCHEMA_FILE = 'layout.schema.json';
export const BIN_DESIGN_SCHEMA_FILE = 'bin-design.schema.json';

export const LAYOUT_SCHEMA_ID = 'https://gridfinitylayouttool.com/schema/layout.schema.json';
export const BIN_DESIGN_SCHEMA_ID =
  'https://gridfinitylayouttool.com/schema/bin-design.schema.json';

/** A loaded schema document. `unknown`-typed values, walked structurally. */
export type SchemaDocument = Record<string, unknown>;

export function readSchema(file: string): SchemaDocument {
  const path = join(SCHEMA_DIR, file);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SchemaDocument;
  } catch (error) {
    throw new Error(`Could not read schema ${path}: ${(error as Error).message}`);
  }
}

export function loadSchemas(): Record<string, SchemaDocument> {
  return {
    [LAYOUT_SCHEMA_FILE]: readSchema(LAYOUT_SCHEMA_FILE),
    [BIN_DESIGN_SCHEMA_FILE]: readSchema(BIN_DESIGN_SCHEMA_FILE),
  };
}

export interface SchemaValidators {
  readonly layout: ValidateFunction;
  readonly binDesign: ValidateFunction;
  readonly binParams: ValidateFunction;
}

/**
 * Both schemas registered in one ajv instance, so the layout schema's absolute
 * `$ref` into the bin-design schema resolves. `x-constant` is registered as a
 * no-op annotation: it records where a bound came from for `bounds.test.ts`
 * and the constraints appendix, and must not affect validation.
 */
export function createValidators(): SchemaValidators {
  const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addKeyword({ keyword: 'x-constant', valid: true, metaSchema: { type: 'object' } });

  ajv.addSchema(readSchema(BIN_DESIGN_SCHEMA_FILE));
  ajv.addSchema(readSchema(LAYOUT_SCHEMA_FILE));

  const layout = ajv.getSchema(LAYOUT_SCHEMA_ID);
  const binDesign = ajv.getSchema(BIN_DESIGN_SCHEMA_ID);
  const binParams = ajv.getSchema(`${BIN_DESIGN_SCHEMA_ID}#/$defs/BinParams`);
  if (!layout || !binDesign || !binParams) {
    throw new Error('Schema compilation failed: a root or $defs/BinParams entry did not resolve');
  }
  return { layout, binDesign, binParams };
}

/** One ajv error rendered as `path: message`, with the offending value. */
export function formatError(error: ErrorObject): string {
  const path = error.instancePath === '' ? '(root)' : error.instancePath;
  const allowed =
    error.keyword === 'enum' && Array.isArray(error.params.allowedValues)
      ? ` (allowed: ${error.params.allowedValues.join(', ')})`
      : '';
  return `${path}: ${error.message ?? 'invalid'}${allowed}`;
}

export function formatErrors(errors: readonly ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(formatError);
}

/** Every `$defs` entry of a schema document, or an empty object if it has none. */
export function defsOf(schema: SchemaDocument): Record<string, SchemaDocument> {
  const defs = schema.$defs;
  return isRecord(defs) ? (defs as Record<string, SchemaDocument>) : {};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every subschema in a document, paired with its JSON pointer. Walks
 * `properties`, `$defs`, `items`, `oneOf`/`anyOf`/`allOf` and
 * `additionalProperties`, which together cover every nesting form the two
 * schemas use.
 */
export function walkSubschemas(
  root: SchemaDocument
): Array<{ pointer: string; schema: Record<string, unknown> }> {
  const out: Array<{ pointer: string; schema: Record<string, unknown> }> = [];
  const visit = (node: unknown, pointer: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, `${pointer}/${i}`));
      return;
    }
    if (!isRecord(node)) return;
    out.push({ pointer, schema: node });
    for (const [key, child] of Object.entries(node)) {
      if (isRecord(child) || Array.isArray(child)) visit(child, `${pointer}/${key}`);
    }
  };
  visit(root, '');
  return out;
}

export type DocumentFormat = 'layout' | 'bin-design';

/**
 * Classifies a document by its own content, not its filename.
 *
 * Deliberately tolerant: hand-authored files are usually being validated
 * BECAUSE a field is missing or wrong, so detection must not fall back to
 * "unknown" the moment the discriminator is the broken part. A wrong `type`
 * value still routes to the bin-design schema, which then reports the bad
 * `type` precisely instead of the CLI shrugging.
 */
export function detectFormat(doc: unknown): DocumentFormat | null {
  if (!isRecord(doc)) return null;
  if (doc.type === 'gridfinity-bin-design') return 'bin-design';
  if (isRecord(doc.params)) return 'bin-design';

  const layoutSignals = ['drawer', 'layers', 'bins', 'categories'].filter((key) => key in doc);
  if (layoutSignals.length >= 2) return 'layout';

  // A `type` we do not recognise is still a design document claiming to be one.
  if (typeof doc.type === 'string') return 'bin-design';
  return null;
}
