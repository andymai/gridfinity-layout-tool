/**
 * Docs to schema parity, the fourth drift guard.
 *
 * The field tables in `docs/schemas/*.md` are generated from the schemas, so
 * this asserts three things:
 *
 *  1. Regenerating produces no diff. A schema change that was not followed by
 *     `pnpm run gen:schema-docs` fails here rather than leaving a table that
 *     quietly describes the old shape.
 *  2. Every `$def` is documented somewhere. A new config cannot be added to a
 *     schema and left out of the reference.
 *  3. Sections marked `indexed` really do point at a source file, so the
 *     layered-depth decision stays deliberate instead of becoming a hole.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOCS_DIR,
  formatMarkdown,
  readDoc,
  renderConstraints,
  renderDoc,
  schemaIndex,
} from './genSchemaDocs';
import { UNCHECKED_DEFS } from '@/shared/schema/keys';
import { BIN_DESIGN_SCHEMA_FILE, LAYOUT_SCHEMA_FILE, defsOf, readSchema } from './loadSchemas';

const GENERATED_DOCS = ['layout.md', 'bin-design.md'];
const ALL_DOCS = [...GENERATED_DOCS, 'README.md', 'constraints.md'];

const index = schemaIndex();

/** Every `<!-- schema:Name -->` marker across the docs. */
function markers(): Map<string, { file: string; indexed: boolean }> {
  const found = new Map<string, { file: string; indexed: boolean }>();
  for (const file of GENERATED_DOCS) {
    const source = readDoc(file);
    for (const match of source.matchAll(/<!-- schema:([\w.:-]+?)(?: (indexed))? -->/g)) {
      found.set(match[1], { file, indexed: match[2] === 'indexed' });
    }
  }
  return found;
}

describe('generated tables are current', () => {
  it.each(GENERATED_DOCS)('%s matches the schema', async (file) => {
    const source = readDoc(file);
    expect(
      await formatMarkdown(renderDoc(source, index)),
      `${file} is stale. Run \`pnpm run gen:schema-docs\` and commit the result.`
    ).toBe(source);
  });

  it('constraints.md matches the x-constant annotations', async () => {
    const current = readFileSync(join(DOCS_DIR, 'constraints.md'), 'utf8');
    expect(
      await formatMarkdown(renderConstraints()),
      'constraints.md is stale. Run `pnpm run gen:schema-docs` and commit the result.'
    ).toBe(current);
  });
});

describe('every schema definition is documented', () => {
  const found = markers();
  const defNames = [
    ...Object.keys(defsOf(readSchema(LAYOUT_SCHEMA_FILE))),
    ...Object.keys(defsOf(readSchema(BIN_DESIGN_SCHEMA_FILE))),
  ];
  const unique = [...new Set(defNames)].sort();

  it.each(unique)('%s has a section', (name) => {
    expect(
      found.has(name),
      `$def "${name}" has no <!-- schema:${name} --> marker in docs/schemas/. Add a section so the reference stays complete.`
    ).toBe(true);
  });

  it('both document roots are documented', () => {
    expect(found.has('root:layout.schema.json')).toBe(true);
    expect(found.has('root:bin-design.schema.json')).toBe(true);
  });

  it('markers name real definitions', () => {
    const unknown = [...found.keys()].filter((name) => !index.has(name));
    expect(unknown, 'docs reference schema names that do not exist').toEqual([]);
  });
});

describe('indexed sections point somewhere', () => {
  const found = markers();
  const indexed = [...found.entries()].filter(([, meta]) => meta.indexed);

  it('only definitions without properties are indexed', () => {
    const allowed = new Set<string>(UNCHECKED_DEFS);
    const unexpected = indexed.map(([name]) => name).filter((name) => !allowed.has(name));
    expect(
      unexpected,
      'a definition with real properties is documented by pointer instead of a table. Generated tables are free to maintain, so prefer one.'
    ).toEqual([]);
  });

  it.each(indexed.map(([name, meta]) => [name, meta.file] as const))(
    '%s cites a source file',
    (name, file) => {
      const source = readDoc(file);
      const start = source.indexOf(`<!-- schema:${name} indexed -->`);
      const next = source.indexOf('<!-- schema:', start + 1);
      const section = source.slice(start, next === -1 ? undefined : next);
      expect(
        /`[\w/.-]+\.ts`/.test(section),
        `the indexed section for "${name}" must cite the .ts file that defines it`
      ).toBe(true);
    }
  );
});

describe('docs are internally consistent', () => {
  it.each(ALL_DOCS)('%s has no unfilled generated region', (file) => {
    const source = readFileSync(join(DOCS_DIR, file), 'utf8');
    expect(source).not.toContain('<!-- generated:start -->\n\n<!-- generated:end -->');
  });
});
