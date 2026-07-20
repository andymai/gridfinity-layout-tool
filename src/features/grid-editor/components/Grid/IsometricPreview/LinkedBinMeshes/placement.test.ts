import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { DesignId } from '@/core/types';
import { designId } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import type { BinRenderData } from '@/shared/hooks/useExplodedLayerView';
import { isRotatedPlacement, designEntryFor, partitionByDesignMesh } from './placement';
import type { DesignGeometryEntry } from './useDesignGeometries';

const D1 = designId('design-1');

function makeBinData(overrides: Partial<BinRenderData> = {}): BinRenderData {
  return {
    bin: createTestBin(),
    x: 0,
    y: 0,
    z: 0,
    height: 1,
    clearanceHeight: 0,
    color: '#ff0000',
    opacity: 1,
    ...overrides,
  };
}

function makeEntry(): DesignGeometryEntry {
  return { sig: 'd1:t1', geometry: new THREE.BufferGeometry(), width: 2, depth: 1 };
}

describe('isRotatedPlacement', () => {
  it('is false when bin matches the design footprint', () => {
    expect(isRotatedPlacement(2, 1, 2, 1)).toBe(false);
  });

  it('is true when bin dimensions are swapped relative to the design', () => {
    expect(isRotatedPlacement(1, 2, 2, 1)).toBe(true);
  });

  it('is false for square designs (rotation is a no-op)', () => {
    expect(isRotatedPlacement(2, 2, 2, 2)).toBe(false);
  });

  it('is false when dimensions mismatch entirely (stale link)', () => {
    expect(isRotatedPlacement(3, 1, 2, 1)).toBe(false);
  });
});

describe('designEntryFor', () => {
  it('resolves the entry for a linked bin', () => {
    const entry = makeEntry();
    const geometries = new Map<DesignId, DesignGeometryEntry>([[D1, entry]]);
    const binData = makeBinData({ bin: createTestBin({ linkedDesignId: D1 }) });

    expect(designEntryFor(binData, geometries)).toBe(entry);
    entry.geometry.dispose();
  });

  it('returns undefined for unlinked bins', () => {
    const geometries = new Map<DesignId, DesignGeometryEntry>([[D1, makeEntry()]]);
    expect(designEntryFor(makeBinData(), geometries)).toBeUndefined();
  });
});

describe('partitionByDesignMesh', () => {
  it('splits bins into mesh-backed and plain groups', () => {
    const entry = makeEntry();
    const geometries = new Map<DesignId, DesignGeometryEntry>([[D1, entry]]);
    const linked = makeBinData({
      bin: createTestBin({ id: 'linked', linkedDesignId: D1 } as never),
    });
    const plain = makeBinData({ bin: createTestBin({ id: 'plain' } as never) });

    const { designMeshBins, plainBins } = partitionByDesignMesh([linked, plain], geometries);

    expect(designMeshBins).toHaveLength(1);
    expect(designMeshBins[0].binData).toBe(linked);
    expect(designMeshBins[0].entry).toBe(entry);
    expect(plainBins).toEqual([plain]);
    entry.geometry.dispose();
  });

  it('keeps linked bins plain while their mesh is unresolved', () => {
    const geometries = new Map<DesignId, DesignGeometryEntry>();
    const linked = makeBinData({ bin: createTestBin({ linkedDesignId: D1 }) });

    const { designMeshBins, plainBins } = partitionByDesignMesh([linked], geometries);

    expect(designMeshBins).toHaveLength(0);
    expect(plainBins).toEqual([linked]);
  });
});
