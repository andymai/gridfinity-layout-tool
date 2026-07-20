import { describe, expect, it } from 'vitest';
import type { ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';
import {
  MAX_IMPORTED_MESH_HEIGHT_UNITS,
  importedMeshDescriptor,
  importedMeshSchema,
} from './descriptor';

const VALID_STRUCTURE: ImportedMeshStructure = {
  kind: 'importedMesh',
  heightUnits: 3,
  asset: {
    name: 'widget_bin',
    data: 'AAAA',
    triangleCount: 12,
    sizeMm: { x: 83.5, y: 41.5, z: 21 },
    outlines: [
      [
        { x: 0, y: 0 },
        { x: 83.5, y: 0 },
        { x: 83.5, y: 41.5 },
        { x: 0, y: 41.5 },
      ],
    ],
  },
  volumeMm3: 12345.6,
  sourceFileName: 'widget_bin.stl',
};

const ENVELOPE = { width: 2, depth: 1 } as ItemEnvelope;

describe('importedMeshSchema', () => {
  it('accepts a valid structure', () => {
    expect(importedMeshSchema.safeParse(VALID_STRUCTURE).success).toBe(true);
  });

  it('rejects non-integer or out-of-range heightUnits', () => {
    expect(importedMeshSchema.safeParse({ ...VALID_STRUCTURE, heightUnits: 2.5 }).success).toBe(
      false
    );
    expect(importedMeshSchema.safeParse({ ...VALID_STRUCTURE, heightUnits: 0 }).success).toBe(
      false
    );
    expect(
      importedMeshSchema.safeParse({
        ...VALID_STRUCTURE,
        heightUnits: MAX_IMPORTED_MESH_HEIGHT_UNITS + 1,
      }).success
    ).toBe(false);
  });

  it('rejects an asset with empty data or zero triangles', () => {
    expect(
      importedMeshSchema.safeParse({
        ...VALID_STRUCTURE,
        asset: { ...VALID_STRUCTURE.asset, data: '' },
      }).success
    ).toBe(false);
    expect(
      importedMeshSchema.safeParse({
        ...VALID_STRUCTURE,
        asset: { ...VALID_STRUCTURE.asset, triangleCount: 0 },
      }).success
    ).toBe(false);
  });

  it('rejects non-finite mesh dimensions', () => {
    expect(
      importedMeshSchema.safeParse({
        ...VALID_STRUCTURE,
        asset: { ...VALID_STRUCTURE.asset, sizeMm: { x: NaN, y: 1, z: 1 } },
      }).success
    ).toBe(false);
  });
});

describe('importedMeshDescriptor', () => {
  it('defaults() returns a schema-valid placeholder and fresh objects per call', () => {
    const a = importedMeshDescriptor.defaults();
    const b = importedMeshDescriptor.defaults();
    expect(importedMeshSchema.safeParse(a).success).toBe(true);
    expect(a).not.toBe(b);
    expect(a.asset).not.toBe(b.asset);
  });

  it('migrate() round-trips a valid structure unchanged', () => {
    expect(importedMeshDescriptor.migrate(VALID_STRUCTURE, ENVELOPE)).toEqual(VALID_STRUCTURE);
  });

  it('migrate() falls back to the placeholder for garbage input', () => {
    const migrated = importedMeshDescriptor.migrate({ heightUnits: 'tall' }, ENVELOPE);
    expect(importedMeshSchema.safeParse(migrated).success).toBe(true);
    expect(migrated.asset.name).toBe('invalid');
  });

  it('exportFileName sanitizes the asset name and falls back to dimensions', () => {
    expect(importedMeshDescriptor.exportFileName(ENVELOPE, VALID_STRUCTURE)).toBe('widget_bin');
    const unnamed = {
      ...VALID_STRUCTURE,
      asset: { ...VALID_STRUCTURE.asset, name: '###' },
    };
    expect(importedMeshDescriptor.exportFileName(ENVELOPE, unnamed)).toBe('imported_bin_2x1');
  });
});
