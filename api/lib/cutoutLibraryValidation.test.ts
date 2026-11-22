import { describe, expect, it } from 'vitest';
import { CONSTRAINTS } from './designerValidationConstants.js';
import { validateLibraryFolder, validateLibraryItem } from './cutoutLibraryValidation.js';

const cutout = {
  id: 'a',
  shape: 'mesh',
  meshId: 'm1',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};
const ref = {
  name: 'tool',
  hash: 'b'.repeat(64),
  triangleCount: 12,
  sizeMm: { x: 10, y: 10, z: 10 },
  bytes: 600,
};
const item = (params: Record<string, unknown>) => ({
  name: 'Pliers',
  folderId: null,
  createdAt: '2026-11-22T10:00:00Z',
  content: { params },
});

describe('validateLibraryItem', () => {
  it('reports the mesh files an item names', () => {
    const result = validateLibraryItem(item({ cutouts: [cutout], meshAssets: { m1: ref } }));
    expect(result.ok && result.meshHashes).toEqual(['b'.repeat(64)]);
    expect(result.ok && result.stored.createdAt).toBe('2026-11-22T10:00:00.000Z');
  });

  it('refuses a mesh cutout without its asset, and an asset no cutout names', () => {
    expect(validateLibraryItem(item({ cutouts: [cutout] })).ok).toBe(false);
    expect(
      validateLibraryItem(item({ cutouts: [cutout], meshAssets: { m1: ref, m2: ref } })).ok
    ).toBe(false);
  });

  it('caps an item without inline meshes at the share budget', () => {
    const label = 'x'.repeat(40);
    const many = Array.from({ length: Math.ceil(CONSTRAINTS.MAX_PAYLOAD_BYTES / 150) }, (_, i) => ({
      ...cutout,
      shape: 'rectangle',
      meshId: undefined,
      id: `c${i}`,
      label,
    }));
    const result = validateLibraryItem(item({ cutouts: many }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe('SIZE_EXCEEDED');
  });
});

describe('validateLibraryFolder', () => {
  it('treats a missing parent as the top level', () => {
    const result = validateLibraryFolder(
      { name: 'Tools', createdAt: '2026-11-22T10:00:00Z' },
      'cfold_0b5f1c9e-3c1a-4a7e-9d2b-6f1e2a3b4c5d'
    );
    expect(result.ok && result.stored.parentId).toBeNull();
  });
});
