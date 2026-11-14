/**
 * Split 3MF export keeps the design's colors on every piece.
 *
 * Classification runs for real here (only the STL parse and the 3MF writer
 * are stubbed), because the defect it guards is in the geometry: a piece
 * classified on its own puts the lip center inside itself and paints corners
 * that belong to the other half of the bin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { lipCellZone, LIP_BANDS } from '@/features/bin-designer/types/featureColors';
import type { LipCorner } from '@/features/bin-designer/types/featureColors';
import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { BinParams } from '@/features/bin-designer/types';
import type { ThreeMFColorConfig, ThreeMFPrintSettings } from '@/shared/generation/export';
import { buildSplit3MFPieces } from './binDownloadHelpers';

const export3MFSpy = vi.hoisted(() =>
  vi.fn((_v: Float32Array, _n: Float32Array, _o: { colorConfig?: unknown }) => new Blob([]))
);

vi.mock('@/shared/generation/export', () => ({
  export3MF: export3MFSpy,
  export3MFMultiObject: () => new Blob([]),
}));

/** Fake STL buffers: the parse mock looks each one up by identity. */
const meshes = vi.hoisted(() => new Map<ArrayBuffer, Float32Array>());
vi.mock('@/features/bin-designer/utils/stlParser', () => ({
  parseSTLBinary: (data: ArrayBuffer) => {
    const vertices = meshes.get(data) ?? new Float32Array(9);
    return ok({ vertices, normals: new Float32Array(vertices.length) });
  },
}));

/** Flat sliver triangle at (x, y, z). */
function sliver(x: number, y: number, z: number): number[] {
  return [x, y, z, x + 0.1, y, z, x, y + 0.1, z];
}

function stl(tris: number[][]): ArrayBuffer {
  const data = new ArrayBuffer(tris.length);
  meshes.set(data, new Float32Array(tris.flat()));
  return data;
}

const CORNER_COLORS: Record<LipCorner, string> = {
  frontLeft: '#ff0000',
  frontRight: '#00ff00',
  backRight: '#0000ff',
  backLeft: '#ffff00',
};

function params(enabled = true): BinParams {
  const cells: Record<string, string> = {};
  for (const [corner, hex] of Object.entries(CORNER_COLORS)) {
    for (const band of LIP_BANDS) cells[lipCellZone(corner as LipCorner, band)] = hex;
  }
  return {
    ...DEFAULT_BIN_PARAMS,
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled,
      body: '#cccccc',
      lid: '#123456',
      lip: { corners: 4, bands: 1, cells },
    },
  };
}

/** Lip slivers at x = -15 and -5 (left piece) or 5 and 15 (right piece), front and back. */
function lipPiece(xs: [number, number]): {
  data: ArrayBuffer;
  faceGroups: FaceGroupData[];
} {
  const tris = xs.flatMap((x) => [sliver(x, -10, 20), sliver(x, 10, 20)]);
  return { data: stl(tris), faceGroups: [{ start: 0, count: 12, tag: FeatureTag.LIP }] };
}

const PRINT_SETTINGS = { layerHeight: 0.2 } as unknown as ThreeMFPrintSettings;

/** Hex color of every triangle in the 3MF written for call `i`. */
function triangleColors(i: number): string[] {
  const config = export3MFSpy.mock.calls[i][2].colorConfig as ThreeMFColorConfig | undefined;
  if (!config) return [];
  return config.triangleMaterialIndices.map((m) => config.materials[m].color.toLowerCase());
}

describe('buildSplit3MFPieces colors', () => {
  beforeEach(() => {
    export3MFSpy.mockClear();
    meshes.clear();
  });

  it('paints each piece with only the lip corners on its side of the bin', async () => {
    const left = lipPiece([-15, -5]);
    const right = lipPiece([5, 15]);

    await buildSplit3MFPieces(
      {
        binPieces: [
          { ...left, label: 'A1' },
          { ...right, label: 'B1' },
        ],
        companionPieces: [],
      },
      params(),
      'bin',
      PRINT_SETTINGS
    );

    expect(new Set(triangleColors(0))).toEqual(
      new Set([CORNER_COLORS.frontLeft, CORNER_COLORS.backLeft])
    );
    expect(new Set(triangleColors(1))).toEqual(
      new Set([CORNER_COLORS.frontRight, CORNER_COLORS.backRight])
    );
  });

  it('colors a companion lid with the lid color when the bin pieces are colored', async () => {
    const left = lipPiece([-15, -5]);
    const right = lipPiece([5, 15]);
    const lid = { data: stl([sliver(0, 0, 0)]), label: 'lid' };

    await buildSplit3MFPieces(
      {
        binPieces: [
          { ...left, label: 'A1' },
          { ...right, label: 'B1' },
        ],
        companionPieces: [lid],
      },
      params(),
      'bin',
      PRINT_SETTINGS
    );

    expect(triangleColors(2)).toEqual(['#123456']);
  });

  it('colors each part of a divider that was cut for the bed', async () => {
    const left = lipPiece([-15, -5]);
    const parts = ['divider-horizontal-part-1', 'divider-horizontal-part-2'].map((label) => ({
      data: stl([sliver(0, 0, 0)]),
      label,
    }));
    const p = params();

    await buildSplit3MFPieces(
      { binPieces: [{ ...left, label: 'A1' }], companionPieces: parts },
      { ...p, featureColors: { ...p.featureColors, dividers: '#abcdef' } },
      'bin',
      PRINT_SETTINGS
    );

    expect(triangleColors(1)).toEqual(['#abcdef']);
    expect(triangleColors(2)).toEqual(['#abcdef']);
  });

  it('writes single-color pieces when the design is single-color', async () => {
    const left = lipPiece([-15, -5]);
    const lid = { data: stl([sliver(0, 0, 0)]), label: 'lid' };

    await buildSplit3MFPieces(
      { binPieces: [{ ...left, label: 'A1' }], companionPieces: [lid] },
      params(false),
      'bin',
      PRINT_SETTINGS
    );

    expect(export3MFSpy.mock.calls.map((c) => c[2].colorConfig)).toEqual([undefined, undefined]);
  });

  it('writes single-color pieces when the worker sent no face groups', async () => {
    const piece = { data: stl([sliver(0, 0, 20)]), label: 'A1' };

    await buildSplit3MFPieces(
      { binPieces: [piece], companionPieces: [] },
      params(),
      'bin',
      PRINT_SETTINGS
    );

    expect(export3MFSpy.mock.calls[0][2].colorConfig).toBeUndefined();
  });
});
