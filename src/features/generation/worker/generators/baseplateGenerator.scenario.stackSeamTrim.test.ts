// @vitest-environment node
/**
 * Stacked plates meet ridge to ridge, and the pocket profile brings every ridge
 * to a zero-width apex at the plate top. The seam trim planes that apex into a
 * land, so the slices either side of the air gap are wide enough to print.
 * Height alone can't show it: a plate cut at the right height with the land
 * missing is still that tall at the cell corners.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MarginPiece } from '@/features/baseplate/types/tiling';
import { computeBaseplateTiling } from '@/features/baseplate/utils/splitPlanner';
import { STACK_SEAM_TRIM_MM } from '@/core/types';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import { PLATE_PROFILE_HEIGHT } from './generatorTypes';
import type { MeshData } from '../../bridge/types';

const NO_OP = (): void => {};
const TRIM = STACK_SEAM_TRIM_MM;
const TRIMMED_TOP = PLATE_PROFILE_HEIGHT - TRIM;

let generateMargin: (p: ResolvedBaseplateParams, m: MarginPiece, forExport: boolean) => MeshData;
let exportConnectorKey: (
  p: ResolvedBaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

beforeAll(async () => {
  await initBrepjs();
  generateMargin = (await import('./baseplateMargin')).generateMargin;
  exportConnectorKey = (await import('./baseplateGenerator')).exportConnectorKey;
}, 30_000);

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: true,
  ...overrides,
});

/** Top surface height along a line across the plate, clear of the cell corners. */
function topAt(plate: MeshData): (x: number) => number {
  const bb = boundingBox(plate.vertices);
  const y = (bb.minY + bb.maxY) / 2 + 10.3;
  return (x: number): number => {
    const hits = columnCrossings(plate, x, y);
    return hits[hits.length - 1];
  };
}

describe('stack-print seam trim', () => {
  it('planes every ridge into a land at the trimmed height', { timeout: 120_000 }, () => {
    const plate = getGenerateBaseplate()(defaults({ stackSeamTrimMm: TRIM }), NO_OP, true);
    assertStructurallyValid(plate);
    assertWatertight(plate);

    const bb = boundingBox(plate.vertices);
    expect(bb.minZ).toBeCloseTo(0, 3);
    expect(bb.maxZ).toBeCloseTo(TRIMMED_TOP, 3);

    const top = topAt(plate);
    const seam = (bb.minX + bb.maxX) / 2;
    // Shared ridge: 2·TRIM wide, centred on the cell boundary.
    expect(top(seam - 0.8 * TRIM)).toBeCloseTo(TRIMMED_TOP, 3);
    expect(top(seam + 0.8 * TRIM)).toBeCloseTo(TRIMMED_TOP, 3);
    // Outer edge: TRIM wide, against the outer wall.
    expect(top(bb.minX + 0.8 * TRIM)).toBeCloseTo(TRIMMED_TOP, 3);
    // Past the land the pocket's 45° taper takes over unchanged.
    expect(top(seam + TRIM + 0.1)).toBeCloseTo(TRIMMED_TOP - 0.1, 2);
    expect(top(bb.minX + TRIM + 0.1)).toBeCloseTo(TRIMMED_TOP - 0.1, 2);
  });

  it(
    'leaves an unstacked plate with knife-edge ridges at full height',
    { timeout: 120_000 },
    () => {
      const plate = getGenerateBaseplate()(defaults(), NO_OP, true);
      const bb = boundingBox(plate.vertices);
      expect(bb.maxZ).toBeCloseTo(PLATE_PROFILE_HEIGHT, 3);
      const seam = (bb.minX + bb.maxX) / 2;
      expect(topAt(plate)(seam + 0.8 * TRIM)).toBeCloseTo(PLATE_PROFILE_HEIGHT - 0.8 * TRIM, 2);
    }
  );

  it('trims a detached rail to stay flush with the stacked plates', { timeout: 120_000 }, () => {
    const params = defaults({
      width: 4,
      depth: 3,
      paddingLeft: 10,
      paddingRight: 10,
      paddingFront: 10,
      paddingBack: 10,
      detachMargins: true,
      stackSeamTrimMm: TRIM,
    });
    const front = computeBaseplateTiling(params, 256).margins.find((m) => m.side === 'front');
    if (!front) throw new Error('no front rail');
    const bb = boundingBox(generateMargin(params, front, false).vertices);
    expect(bb.minZ).toBeCloseTo(0, 3);
    expect(bb.maxZ).toBeCloseTo(TRIMMED_TOP, 3);
  });

  it(
    'trims the seated key to stay flush with the stacked plates',
    { timeout: 120_000 },
    async () => {
      const { data } = await exportConnectorKey(
        defaults({ connectorNubs: true, connectorStyle: 'dovetailKey', stackSeamTrimMm: TRIM }),
        'stl'
      );
      const parsed = parseSTLBinary(data);
      expect(isOk(parsed)).toBe(true);
      if (!isOk(parsed)) return;
      const bb = boundingBox(parsed.value.vertices);
      expect(bb.minZ).toBeCloseTo(0, 3);
      expect(bb.maxZ).toBeCloseTo(TRIMMED_TOP, 3);
    }
  );
});
