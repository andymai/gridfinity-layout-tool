/**
 * Docs to schema parity, the fourth drift guard.
 *
 * The field tables in `docs/schemas/*.md` are generated from the schemas, so
 * this asserts:
 *
 *  1. Regenerating produces no diff. A schema change that was not followed by
 *     `pnpm run gen:schema-docs` fails here rather than leaving a table that
 *     quietly describes the old shape.
 *  2. Every `$def` is documented somewhere. A new config cannot be added to a
 *     schema and left out of the reference.
 *  3. The layering is deliberate in both directions: a definition is only
 *     documented by pointer if it is declared in `INDEXED_DEFS`, every declared
 *     one really is indexed, and each cites the type that defines it.
 *  4. Every cross-reference resolves, which nothing else checks.
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
import { INDEXED_DEFS, UNCHECKED_DEFS } from '@/shared/schema/keys';
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

  it('every indexed section is a declared one', () => {
    const declared = new Set<string>([...INDEXED_DEFS, ...UNCHECKED_DEFS]);
    const undeclared = indexed.map(([name]) => name).filter((name) => !declared.has(name));
    expect(
      undeclared,
      'a definition is documented by pointer without being listed in INDEXED_DEFS. Give it a table, or declare the demotion so the layering stays a decision rather than an omission.'
    ).toEqual([]);
  });

  it('every declared indexed def is actually indexed', () => {
    const actual = new Set(indexed.map(([name]) => name));
    const missing = [...INDEXED_DEFS].filter((name) => !actual.has(name));
    expect(
      missing,
      'INDEXED_DEFS names definitions that still carry a full table. Remove them from the list, or index them.'
    ).toEqual([]);
  });

  it('tabled defs are not silently listed as indexed', () => {
    const overlap = [...INDEXED_DEFS].filter((name) =>
      (UNCHECKED_DEFS as readonly string[]).includes(name)
    );
    expect(overlap, 'a def is in both INDEXED_DEFS and UNCHECKED_DEFS').toEqual([]);
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

/**
 * The tables render `$ref`s as links, and nothing else checks that those
 * targets exist. Headings are prose-named ("## Handles" for `HandleConfig`), so
 * the generator emits an explicit anchor per section; this is what proves it.
 */
describe('cross-references resolve', () => {
  const slug = (heading: string): string =>
    heading
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/ /g, '-');

  /** Every anchor a document offers: heading slugs plus explicit ids. */
  function anchorsOf(file: string): Set<string> {
    const source = readFileSync(join(DOCS_DIR, file), 'utf8');
    const out = new Set<string>();
    for (const [, heading] of source.matchAll(/^#{1,6}\s+(.+)$/gm)) out.add(slug(heading));
    for (const [, id] of source.matchAll(/<a id="([\w.:-]+)"><\/a>/g)) out.add(id);
    return out;
  }

  const anchors = new Map(ALL_DOCS.map((file) => [file, anchorsOf(file)] as const));

  it.each(ALL_DOCS)('%s links land on a real anchor', (file) => {
    const source = readFileSync(join(DOCS_DIR, file), 'utf8');
    const dead: string[] = [];
    // An empty document group means the link is local to this file.
    for (const [, doc, target] of source.matchAll(/\]\(([\w-]*\.md)?#([\w-]+)\)/g)) {
      const targetFile = doc ?? file;
      const known = anchors.get(targetFile);
      if (known === undefined) {
        dead.push(`${targetFile} (unknown document)`);
      } else if (!known.has(target)) {
        dead.push(`${targetFile}#${target}`);
      }
    }
    expect(
      [...new Set(dead)].sort(),
      `${file} links to anchors that do not exist. Run \`pnpm run gen:schema-docs\`.`
    ).toEqual([]);
  });
});
