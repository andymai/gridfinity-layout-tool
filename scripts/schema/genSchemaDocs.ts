/**
 * Renders the field tables in `docs/schemas/*.md` from the published schemas.
 *
 * Narrative prose is hand-written and untouched. Only the regions between
 * `<!-- generated:start -->` and `<!-- generated:end -->` are rewritten, and
 * each is bound to a `$def` by the `<!-- schema:Name -->` marker above it. The
 * schema descriptions ARE the reference prose, so a field can never be
 * documented with stale wording, a stale bound, or not at all.
 *
 * `docs.test.ts` asserts regenerating produces no diff, so a stale doc fails
 * CI rather than quietly misleading a reader.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, resolveConfig } from 'prettier';
import {
  BIN_DESIGN_SCHEMA_FILE,
  LAYOUT_SCHEMA_FILE,
  defsOf,
  isRecord,
  readSchema,
  walkSubschemas,
} from './loadSchemas';

export const DOCS_DIR = join(process.cwd(), 'docs/schemas');

export const START = '<!-- generated:start -->';
export const END = '<!-- generated:end -->';
const MARKER = /<!-- schema:([\w.:-]+?)(?: (indexed))? -->/;

/** `$def` name to subschema, across both files, plus the two document roots. */
export function schemaIndex(): Map<string, Record<string, unknown>> {
  const index = new Map<string, Record<string, unknown>>();
  const layout = readSchema(LAYOUT_SCHEMA_FILE);
  const binDesign = readSchema(BIN_DESIGN_SCHEMA_FILE);
  for (const doc of [binDesign, layout]) {
    for (const [name, def] of Object.entries(defsOf(doc))) index.set(name, def);
  }
  index.set('root:layout.schema.json', layout);
  index.set('root:bin-design.schema.json', binDesign);
  return index;
}

function anchor(name: string): string {
  return name.toLowerCase();
}

function renderType(subschema: unknown): string {
  if (!isRecord(subschema)) return '`any`';
  const ref = subschema.$ref;
  if (typeof ref === 'string') {
    const name = ref.slice(ref.lastIndexOf('/') + 1);
    return `[\`${name}\`](#${anchor(name)})`;
  }
  if (subschema.const !== undefined) return `\`${JSON.stringify(subschema.const)}\``;
  if (Array.isArray(subschema.enum)) {
    return subschema.enum.map((v) => `\`${JSON.stringify(v)}\``).join(' \\| ');
  }
  if (Array.isArray(subschema.oneOf)) return subschema.oneOf.map(renderType).join(' \\| ');
  if (subschema.type === 'array') return `${renderType(subschema.items)}[]`;
  if (Array.isArray(subschema.type))
    return subschema.type.map((t) => `\`${String(t)}\``).join(' \\| ');
  if (subschema.type === 'object' && subschema.additionalProperties !== undefined) {
    return `object of ${renderType(subschema.additionalProperties)}`;
  }
  return typeof subschema.type === 'string' ? `\`${subschema.type}\`` : '`any`';
}

function renderConstraint(s: Record<string, unknown>): string {
  const parts: string[] = [];
  const num = (key: string, label: string): void => {
    if (typeof s[key] === 'number') parts.push(`${label} ${String(s[key])}`);
  };
  num('minimum', '>=');
  num('exclusiveMinimum', '>');
  num('maximum', '<=');
  num('multipleOf', 'step');
  num('minLength', 'length >=');
  num('maxLength', 'length <=');
  num('minItems', 'items >=');
  num('maxItems', 'items <=');
  if (typeof s.pattern === 'string') parts.push(`\`${s.pattern}\``);
  return parts.join(', ');
}

/**
 * Renders a value as one markdown table cell.
 *
 * Backslashes are escaped BEFORE pipes, not after: escaping pipes first would
 * let a description containing a literal backslash produce `\\|`, which renders
 * as a stray backslash and an unescaped cell break.
 */
function cell(text: unknown): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderTable(subschema: Record<string, unknown>): string {
  const properties = isRecord(subschema.properties) ? subschema.properties : {};
  const required = new Set(Array.isArray(subschema.required) ? subschema.required.map(String) : []);
  const rows = Object.entries(properties).map(([name, raw]) => {
    const value = isRecord(raw) ? raw : {};
    const fallback = value.default !== undefined ? `\`${JSON.stringify(value.default)}\`` : '';
    return `| \`${name}\` | ${renderType(value)} | ${required.has(name) ? 'yes' : ''} | ${fallback} | ${renderConstraint(value)} | ${cell(value.description)} |`;
  });
  if (rows.length === 0) return '_No fixed properties._';
  return [
    '| Field | Type | Required | Default | Constraint | Notes |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

/**
 * Refills every generated region in a document. A marker tagged `indexed`
 * documents a niche config by pointer rather than by table, so its region is
 * left for the author.
 */
export function renderDoc(source: string, index: Map<string, Record<string, unknown>>): string {
  const lines = source.split('\n');
  const out: string[] = [];
  let i = 0;
  let pending: { name: string; indexed: boolean } | null = null;

  while (i < lines.length) {
    const line = lines[i];
    const match = MARKER.exec(line);
    if (match) {
      pending = { name: match[1], indexed: match[2] === 'indexed' };
      out.push(line);
      i += 1;
      continue;
    }
    if (line.trim() === START) {
      const close = lines.indexOf(END, i);
      if (close === -1) throw new Error(`Unclosed ${START} near line ${i + 1}`);
      if (pending === null)
        throw new Error(`${START} at line ${i + 1} has no schema marker above it`);
      if (pending.indexed) {
        out.push(...lines.slice(i, close + 1));
      } else {
        const subschema = index.get(pending.name);
        if (subschema === undefined) {
          throw new Error(`Marker names "${pending.name}", which is not a $def or document root`);
        }
        out.push(START, '', renderTable(subschema), '', END);
      }
      pending = null;
      i = close + 1;
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join('\n');
}

export function readDoc(file: string): string {
  return readFileSync(join(DOCS_DIR, file), 'utf8');
}

/**
 * Turns a JSON pointer into the field path a reader would recognise:
 * `/$defs/BinParams/properties/width` becomes `BinParams.width`. Root-level
 * properties are prefixed with the document, since both documents have a
 * `gridUnitMm` and an unqualified name would be ambiguous.
 */
function readablePath(file: string, pointer: string): string {
  const parts = pointer
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== '$defs' && segment !== 'properties' && segment !== 'items');
  const prefix = file === LAYOUT_SCHEMA_FILE ? 'Layout' : 'BinDesign';
  if (parts.length === 0) return prefix;
  return pointer.startsWith('/$defs/') ? parts.join('.') : `${prefix}.${parts.join('.')}`;
}

interface ConstantUse {
  readonly value: unknown;
  readonly sites: string[];
}

/**
 * The constraints appendix, built from the `x-constant` annotations.
 *
 * Values are read from the schema rather than imported from the constants
 * modules, because `bounds.test.ts` already proves the two are equal. That
 * keeps the generator free of app imports while staying accurate.
 */
export function renderConstraints(): string {
  const uses = new Map<string, ConstantUse>();
  for (const file of [LAYOUT_SCHEMA_FILE, BIN_DESIGN_SCHEMA_FILE]) {
    for (const { pointer, schema } of walkSubschemas(readSchema(file))) {
      const annotation = schema['x-constant'];
      if (!isRecord(annotation)) continue;
      for (const [keyword, path] of Object.entries(annotation)) {
        const key = String(path);
        const existing = uses.get(key) ?? { value: schema[keyword], sites: [] };
        existing.sites.push(`\`${readablePath(file, pointer)}\` (${keyword})`);
        uses.set(key, { value: schema[keyword], sites: existing.sites });
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const [path, use] of [...uses.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const namespace = path.includes('.') ? path.slice(0, path.indexOf('.')) : 'Module constants';
    const rows = groups.get(namespace) ?? [];
    const name = path.includes('.') ? path.slice(path.indexOf('.') + 1) : path;
    rows.push(
      `| \`${name}\` | \`${JSON.stringify(use.value)}\` | ${[...new Set(use.sites)].sort().join(', ')} |`
    );
    groups.set(namespace, rows);
  }

  const header = `# Constraints appendix

Every numeric bound and enumerated value in the two schemas that mirrors a
source constant, with the constant it comes from and the fields it bounds.

This file is generated by \`pnpm run gen:schema-docs\` from the \`x-constant\`
annotations in the schemas. \`bounds.test.ts\` proves each annotated bound still
equals its constant, so the values here cannot drift from the code.

Bounds without an entry here are hand-picked rather than derived: percentages
bounded at 0 and 100, fractions at 0 and 1, and counts at 1.
`;

  const sections = [...groups.entries()]
    .sort(([a], [b]) =>
      a === 'Module constants' ? 1 : b === 'Module constants' ? -1 : a.localeCompare(b)
    )
    .map(([namespace, rows]) => {
      const title = namespace === 'Module constants' ? 'Module constants' : `\`${namespace}\``;
      return [
        `## ${title}`,
        '',
        '| Constant | Value | Bounds |',
        '| --- | --- | --- |',
        ...rows,
      ].join('\n');
    });

  return `${header}\n${sections.join('\n\n')}\n`;
}

/**
 * Formats generated markdown the way the repo's prettier would.
 *
 * Without this the generator and the pre-commit formatter fight: prettier
 * realigns table pipes, so the committed file would never equal fresh
 * generator output and the freshness check could never pass.
 */
export async function formatMarkdown(source: string): Promise<string> {
  const options = await resolveConfig(join(DOCS_DIR, 'layout.md'));
  return format(source, { ...options, parser: 'markdown' });
}
