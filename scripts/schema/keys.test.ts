/**
 * Manifest to schema parity: the second link in the type -> manifest -> schema
 * chain.
 *
 * `src/shared/schema/keys.ts` already binds each manifest to its TypeScript
 * interface at compile time. This binds the same manifest to the shipped JSON
 * Schema, so a `$def` cannot gain, lose, or rename a property without the
 * manifest (and therefore the interface) agreeing.
 */

import { describe, expect, it } from 'vitest';
import { SCHEMA_KEYS, SCHEMA_ROOT_KEYS, UNCHECKED_DEFS } from '@/shared/schema/keys';
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
