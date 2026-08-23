/**
 * Manifest to schema parity: the second link in the type -> manifest -> schema
 * chain.
 *
 * `src/shared/schema/keys.ts` already binds each manifest to its TypeScript
 * interface at compile time. This binds the same manifest to the shipped JSON
 * Schema, so a `$def` cannot gain, lose, or rename a property without the
 * manifest (and therefore the interface) agreeing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SCHEMA_KEYS,
  SCHEMA_ROOT_KEYS,
  UNCHECKED_DEFS,
  UNTYPED_MANIFESTS,
} from '@/shared/schema/keys';
import {
  BIN_DESIGN_SCHEMA_FILE,
  LAYOUT_SCHEMA_FILE,
  defsOf,
  isRecord,
  loadSchemas,
} from './loadSchemas';

const schemas = loadSchemas();

/** Every `$def` across both schema files, as `name -> subschema`. */
function allDefs(): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const doc of Object.values(schemas)) {
    for (const [name, def] of Object.entries(defsOf(doc))) {
      out.set(name, def);
    }
  }
  return out;
}

function propertyNames(subschema: Record<string, unknown>): string[] {
  const props = subschema.properties;
  return isRecord(props) ? Object.keys(props) : [];
}

const defs = allDefs();
const unchecked = new Set<string>(UNCHECKED_DEFS);

describe('schema $defs are covered by a key manifest', () => {
  const checkable = [...defs.keys()].filter((name) => !unchecked.has(name)).sort();

  it.each(checkable)('%s properties match its manifest', (name) => {
    const manifest = (SCHEMA_KEYS as Record<string, readonly string[]>)[name];
    expect(
      manifest,
      `$def "${name}" has no entry in SCHEMA_KEYS. Add one in src/shared/schema/keys.ts so the type is checked too, or list it in UNCHECKED_DEFS with a reason.`
    ).toBeDefined();

    const subschema = defs.get(name);
    expect(subschema).toBeDefined();
    expect([...propertyNames(subschema as Record<string, unknown>)].sort()).toEqual(
      [...manifest].sort()
    );
  });

  it('every manifest corresponds to a $def', () => {
    const orphans = Object.keys(SCHEMA_KEYS).filter((name) => !defs.has(name));
    expect(orphans, 'SCHEMA_KEYS lists names with no matching $def in either schema file').toEqual(
      []
    );
  });

  it('unchecked defs really do exist and really do lack properties', () => {
    for (const name of unchecked) {
      expect(defs.has(name), `UNCHECKED_DEFS names "${name}", which is not a $def`).toBe(true);
      expect(
        propertyNames(defs.get(name) as Record<string, unknown>),
        `"${name}" now has properties, so it should be checked rather than exempted`
      ).toEqual([]);
    }
  });
});

describe('schema roots match their document manifests', () => {
  it.each([LAYOUT_SCHEMA_FILE, BIN_DESIGN_SCHEMA_FILE])('%s', (file) => {
    const manifest = (SCHEMA_ROOT_KEYS as Record<string, readonly string[]>)[file];
    expect(manifest, `no SCHEMA_ROOT_KEYS entry for ${file}`).toBeDefined();
    expect([...propertyNames(schemas[file])].sort()).toEqual([...manifest].sort());
  });
});

describe('every $ref resolves', () => {
  it.each(Object.keys(schemas))('%s', (file) => {
    const doc = schemas[file];
    const refs: string[] = [];
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!isRecord(node)) return;
      if (typeof node.$ref === 'string') refs.push(node.$ref);
      Object.values(node).forEach(collect);
    };
    collect(doc);

    for (const ref of refs) {
      const local = ref.startsWith('#/$defs/');
      const name = ref.slice(ref.indexOf('$defs/') + '$defs/'.length);
      if (local) {
        expect(
          Object.keys(defsOf(doc)),
          `${file} references missing local $def "${name}"`
        ).toContain(name);
      } else {
        expect(defs.has(name), `${file} references missing cross-file $def "${name}"`).toBe(true);
      }
    }
  });
});

/**
 * Guards the guard. The compile-time assertions live in the type system, so no
 * runtime test can observe them directly. This reads the manifest sources and
 * asserts every `*_KEYS` const is paired with a `KeysMatch` assertion, which is
 * what stops a new manifest from silently shipping without one.
 */
describe('every manifest has a compile-time assertion', () => {
  const MANIFEST_FILES = ['layoutKeys.ts', 'binDesignKeys.ts', 'binContentKeys.ts'];
  const exempt = new Set<string>(UNTYPED_MANIFESTS);

  it.each(MANIFEST_FILES)('%s', (file) => {
    const source = readFileSync(join(process.cwd(), 'src/shared/schema', file), 'utf8');
    const declared = [...source.matchAll(/^export const (\w+_KEYS) =/gm)].map((m) => m[1]);
    const asserted = new Set(
      [...source.matchAll(/\(typeof (\w+_KEYS)\)\[number\]/g)].map((m) => m[1])
    );
    const missing = declared.filter((name) => !asserted.has(name) && !exempt.has(name));
    expect(
      missing,
      `these manifests have no KeysMatch assertion, so their type can drift silently. Add one, or list it in UNTYPED_MANIFESTS with a reason.`
    ).toEqual([]);
  });

  it('exemptions are real and still needed', () => {
    const all = MANIFEST_FILES.map((file) =>
      readFileSync(join(process.cwd(), 'src/shared/schema', file), 'utf8')
    ).join('\n');
    for (const name of exempt) {
      expect(all, `UNTYPED_MANIFESTS names "${name}", which does not exist`).toContain(
        `export const ${name} =`
      );
      expect(
        all.includes(`(typeof ${name})[number]`),
        `"${name}" now has an assertion, so it should come out of UNTYPED_MANIFESTS`
      ).toBe(false);
    }
  });
});
