/**
 * The lid's own top lip painting the `lidLip` grid at export.
 *
 * Kept apart from `binDownloadHelpers.test.ts` because that file's
 * `parseSTLBinary` mock returns a single zeroed triangle — enough to assert a
 * uniform slot, but degenerate for classification (every centroid at the
 * origin, so quadrants and bands collapse). These cases need real spread.
 */
import { describe, it, expect, vi } from 'vitest';
import { ok } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import { FeatureTag } from '@/shared/types/generation';
import type { BinParams } from '@/features/bin-designer/types';
import type { ThreeMFPrintSettings } from '@/shared/generation/export';

const export3MFMultiObjectSpy = vi.fn((..._args: unknown[]) => new Blob([]));

vi.mock('@/shared/generation/export', () => ({
  export3MF: () => new Blob([]),
  export3MFMultiObject: (...args: unknown[]) => export3MFMultiObjectSpy(...args),
}));

/**
 * Four triangles, one per XY quadrant, each a flat sliver so its centroid is
 * unambiguous. Z spreads 0→3 so band classification has range to work with.
 */
const QUADS: [number, number, number][] = [
  [-10, -10, 0], // frontLeft, low
  [10, -10, 1], // frontRight
  [10, 10, 2], // backRight
  [-10, 10, 3], // backLeft, high
];

function quadVertices(): Float32Array {
  const v = new Float32Array(QUADS.length * 9);
  QUADS.forEach(([x, y, z], t) => {
    for (let corner = 0; corner < 3; corner++) {
      v[t * 9 + corner * 3] = x;
      v[t * 9 + corner * 3 + 1] = y;
      v[t * 9 + corner * 3 + 2] = z;
    }
  });
  return v;
}

vi.mock('@/features/bin-designer/utils/stlParser', () => ({
  parseSTLBinary: () => ok({ vertices: quadVertices(), normals: quadVertices() }),
}));

vi.mock('@/features/bin-designer/utils/materialMapping', () => ({
  buildTriangleMaterialIndices: () => ({
    config: { materials: [{ color: '#ffffff' }], triangleMaterialIndices: [0, 0, 0, 0] },
  }),
}));

const PRINT_SETTINGS = {
  layerHeight: 0.2,
  infillPercent: 20,
  material: 'PLA',
} as unknown as ThreeMFPrintSettings;

/** Every triangle tagged as the lid's own lip. */
const LID_LIP_GROUPS = [{ start: 0, count: QUADS.length * 3, tag: FeatureTag.LID_LIP }];

const PIECES = [
  { label: 'bin' as const, data: new ArrayBuffer(0) },
  { label: 'lid' as const, data: new ArrayBuffer(0) },
];

function params(lidLip?: BinParams['featureColors']['lidLip']): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    featureColors: {
      ...DEFAULT_BIN_PARAMS.featureColors,
      enabled: true,
      lid: '#111111',
      ...(lidLip ? { lidLip } : {}),
    },
  };
}

function lidIndices(): number[] {
  const objects = export3MFMultiObjectSpy.mock.calls[0][0] as Array<{
    colorConfig?: { triangleMaterialIndices: number[] };
  }>;
  return objects[1].colorConfig?.triangleMaterialIndices ?? [];
}

describe('lid top-lip colours at export', () => {
  it('paints each quadrant its own slot when the lid lip grid has four corners', async () => {
    const { buildMultiObject3MF } = await import('./binDownloadHelpers');
    export3MFMultiObjectSpy.mockClear();
    const cells = makeUniformLipCells('#111111');
    cells['lip:frontLeft:0'] = '#ff0000';
    cells['lip:frontRight:0'] = '#00ff00';
    cells['lip:backRight:0'] = '#0000ff';
    cells['lip:backLeft:0'] = '#ffff00';

    buildMultiObject3MF(
      PIECES,
      [],
      params({ corners: 4, bands: 1, cells }),
      'assembly',
      PRINT_SETTINGS,
      LID_LIP_GROUPS
    );

    // Four distinct quadrant colours → four distinct material slots.
    expect(new Set(lidIndices()).size).toBe(4);
  });

  it('keeps the lid uniform when no lid lip grid is stored', async () => {
    const { buildMultiObject3MF } = await import('./binDownloadHelpers');
    export3MFMultiObjectSpy.mockClear();

    buildMultiObject3MF(PIECES, [], params(), 'assembly', PRINT_SETTINGS, LID_LIP_GROUPS);

    // Absent grid means "inherits lid", so every triangle lands on one slot.
    expect(new Set(lidIndices()).size).toBe(1);
  });

  // Without the worker sending the lid's groups there is nothing to classify
  // against, so the lid must fall back rather than mispaint.
  it('keeps the lid uniform when the worker sent no lid face groups', async () => {
    const { buildMultiObject3MF } = await import('./binDownloadHelpers');
    export3MFMultiObjectSpy.mockClear();
    const cells = makeUniformLipCells('#111111');
    cells['lip:frontLeft:0'] = '#ff0000';

    buildMultiObject3MF(
      PIECES,
      [],
      params({ corners: 4, bands: 1, cells }),
      'assembly',
      PRINT_SETTINGS,
      undefined
    );

    expect(new Set(lidIndices()).size).toBe(1);
  });
});
