import { describe, expect, it } from 'vitest';
import { designId } from '@/core/types';
import type { BinParams, SavedDesign } from '../types';
import { designFootprint, isBinDesign, isLayoutPlaceableDesign } from './designKind';

function baseDesign(): Omit<SavedDesign, 'params'> {
  return {
    id: designId('d1'),
    name: 'Test',
    thumbnail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    exportFileNameConfig: null,
  };
}

describe('isBinDesign', () => {
  it('accepts a params-bearing design without a kind field', () => {
    const design: SavedDesign = { ...baseDesign(), params: { width: 2 } as BinParams };
    expect(isBinDesign(design)).toBe(true);
  });

  it('rejects non-bin kinds', () => {
    const design: SavedDesign = {
      ...baseDesign(),
      kind: 'importedMesh',
      envelope: { width: 2, depth: 1 } as SavedDesign['envelope'],
      structure: { kind: 'importedMesh', heightUnits: 3 } as SavedDesign['structure'],
    };
    expect(isBinDesign(design)).toBe(false);
  });
});

describe('isLayoutPlaceableDesign', () => {
  const assemblyStructure = {
    kind: 'assembly',
    schemaVersion: 1,
    base: { floorThickness: 2 },
    mirrorAxis: 'x',
    parts: [],
  } as unknown as SavedDesign['structure'];
  const envelope = { width: 2, depth: 3 } as SavedDesign['envelope'];

  it('accepts bins, imported meshes, and assemblies', () => {
    expect(isLayoutPlaceableDesign({ ...baseDesign(), params: { width: 2 } as BinParams })).toBe(
      true
    );
    expect(
      isLayoutPlaceableDesign({
        ...baseDesign(),
        kind: 'importedMesh',
        envelope,
        structure: { kind: 'importedMesh', heightUnits: 3 } as SavedDesign['structure'],
      })
    ).toBe(true);
    expect(
      isLayoutPlaceableDesign({
        ...baseDesign(),
        kind: 'assembly',
        envelope,
        structure: assemblyStructure,
      })
    ).toBe(true);
  });

  it('rejects tool racks and an assembly missing its envelope', () => {
    expect(
      isLayoutPlaceableDesign({
        ...baseDesign(),
        kind: 'toolRack',
        envelope,
        structure: { kind: 'toolRack' } as unknown as SavedDesign['structure'],
      })
    ).toBe(false);
    expect(
      isLayoutPlaceableDesign({ ...baseDesign(), kind: 'assembly', structure: assemblyStructure })
    ).toBe(false);
  });
});

describe('designFootprint', () => {
  it('reads bin dimensions from params', () => {
    const design: SavedDesign = {
      ...baseDesign(),
      params: { width: 3, depth: 2, height: 6 } as BinParams,
    };
    expect(designFootprint(design)).toEqual({ width: 3, depth: 2, height: 6 });
  });

  it('reads importedMesh height from structure.heightUnits', () => {
    const design: SavedDesign = {
      ...baseDesign(),
      kind: 'importedMesh',
      envelope: { width: 2, depth: 1 } as SavedDesign['envelope'],
      structure: { kind: 'importedMesh', heightUnits: 3 } as SavedDesign['structure'],
    };
    expect(designFootprint(design)).toEqual({ width: 2, depth: 1, height: 3 });
  });

  it('derives assembly height from the tallest placed part', () => {
    const design = {
      id: 'w',
      name: 'W',
      kind: 'assembly',
      thumbnail: null,
      exportFileNameConfig: null,
      createdAt: '',
      updatedAt: '',
      envelope: { width: 4, depth: 2, gridUnitMm: 42, heightUnitMm: 7 },
      structure: {
        kind: 'assembly',
        schemaVersion: 1,
        base: { floorThickness: 2 },
        mirrorAxis: 'x',
        parts: [
          {
            id: 'p',
            type: 'post',
            params: { diameter: 8, height: 40, taperDeg: 0, tipChamfer: 1 },
            transform: { x: 20, y: 20, seatZ: 0, rotZDeg: 0 },
            children: [],
          },
        ],
      },
    } as unknown as Parameters<typeof designFootprint>[0];
    // 40mm post + 5mm socket + 2mm floor = 47mm -> ceil(47/7) = 7 units.
    expect(designFootprint(design)).toEqual({ width: 4, depth: 2, height: 7 });
  });

  it('keeps height 0 for non-bin kinds without a claimed height', () => {
    const design: SavedDesign = {
      ...baseDesign(),
      kind: 'toolRack',
      envelope: { width: 4, depth: 1 } as SavedDesign['envelope'],
      structure: { kind: 'toolRack' } as SavedDesign['structure'],
    };
    expect(designFootprint(design)).toEqual({ width: 4, depth: 1, height: 0 });
  });

  it('returns zeros for a record with neither params nor envelope', () => {
    const design = baseDesign() as SavedDesign;
    expect(designFootprint(design)).toEqual({ width: 0, depth: 0, height: 0 });
  });
});
