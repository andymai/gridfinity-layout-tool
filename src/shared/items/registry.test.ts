import { describe, expect, it } from 'vitest';
import '@/shared/items/registerDescriptors';
import { getItemDescriptor, hasItemDescriptor, listItemDescriptors } from '@/shared/items/registry';
import { DEFAULT_TOOL_RACK_STRUCTURE } from '@/shared/items/toolRack/descriptor';
import type { ItemEnvelope } from '@/shared/types/item';

const envelope: ItemEnvelope = {
  width: 4,
  depth: 2,
  gridUnitMm: 42,
  heightUnitMm: 7,
  attachment: {
    magnetHoles: false,
    magnetDiameter: 6,
    magnetDepth: 2,
    screwHoles: false,
    screwDiameter: 3,
  },
  featureColors: { enabled: false } as never,
};

describe('item descriptor registry', () => {
  it('registers bin, toolRack, and importedMesh', () => {
    expect(hasItemDescriptor('bin')).toBe(true);
    expect(hasItemDescriptor('toolRack')).toBe(true);
    expect(hasItemDescriptor('importedMesh')).toBe(true);
    expect(
      listItemDescriptors()
        .map((d) => d.kind)
        .sort()
    ).toEqual(['bin', 'importedMesh', 'toolRack']);
  });

  it('throws on an unregistered kind', () => {
    expect(() => getItemDescriptor('nope' as never)).toThrow(/No item descriptor/);
  });

  it('rack defaults() returns a fresh, schema-valid structure', () => {
    const d = getItemDescriptor('toolRack');
    const a = d.defaults();
    const b = d.defaults();
    expect(a).not.toBe(b);
    expect(a.backRail).not.toBe(b.backRail);
    expect(d.schema.safeParse(a).success).toBe(true);
  });

  it('rack migrate() clamps and fills missing fields', () => {
    const d = getItemDescriptor('toolRack');
    const migrated = d.migrate({ finAngleDeg: 999, finHeight: 30 }, envelope);
    expect(migrated.kind).toBe('toolRack');
    // out-of-range angle falls back to defaults rather than producing an invalid structure
    expect(migrated).toEqual(DEFAULT_TOOL_RACK_STRUCTURE);
  });

  it('rack exportFileName encodes the footprint', () => {
    expect(
      getItemDescriptor('toolRack').exportFileName(envelope, DEFAULT_TOOL_RACK_STRUCTURE)
    ).toBe('tool_rack_4x2');
  });
});
