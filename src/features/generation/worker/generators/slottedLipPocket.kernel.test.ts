// @vitest-environment node
/**
 * A divider must be able to reach its slot past the stacking lip.
 *
 * The wall pocket stops at the interior ceiling and the lip-zone cutter only
 * took the lip's inward jut, so everything OUTBOARD of the inner wall face
 * stayed: the wall's own top stub and then the lip body above it, roofing the
 * pocket over for the whole lip band. The slot's width and depth are correct
 * everywhere they are measured, which is why nothing caught it (#4148).
 *
 * Measured as a boolean volume, never by column crossings: a slotted bin is
 * built from box cutters, and the coincident faces those leave break the
 * parity that `verticalSolidSpans` pairs on — it reads this bin's walls as
 * hollow. `sharedVolume` in `__kernel-tests__/hingeSwing.ts` documents the
 * same trap for the hinge.
 *
 * Stated against the same bin with no lip, so the lip is the only variable.
 *
 *   pnpm run test:run src/features/generation/worker/generators/slottedLipPocket.kernel
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import type { Shape3D, ValidSolid } from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { initTestKernel } from '@/test/initTestKernel';
import { boundingBox, meshVolume } from './__kernel-tests__/meshAssertions';
import { getEffectiveSlotDimensions } from './slotBuilder';

let generateBin: (params: BinParams) => MeshData;
let getLastSolid: () => Shape3D | null;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
  getLastSolid = (await import('./shapeCache')).getLastSolid;
}, 120000);

/**
 * A boolean over coincident faces can legitimately produce nothing, which is
 * the answer this probe wants: no shared volume.
 */
async function sharedVolume(a: Shape3D, b: Shape3D): Promise<number> {
  const { intersect, mesh } = await import('brepjs');
  const result = intersect(a as ValidSolid, b as ValidSolid);
  if (!result.ok) return 0;
  const overlap = result.value;
  try {
    const m = mesh(overlap, { tolerance: 0.05, angularTolerance: 10 });
    return Math.abs(
      meshVolume({ vertices: m.vertices, indices: m.triangles } as unknown as MeshData)
    );
  } finally {
    overlap.delete();
  }
}

function slottedBin(stackingLip: boolean): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    style: 'slotted',
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip },
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 42 },
      y: { enabled: false, pitch: 42 },
    },
  };
}

/**
 * Material (mm³) standing in a divider tab's way as it is lowered into its
 * slot, over the stretch above the divider's own resting top.
 *
 * The tab is modelled inset off both pocket faces, so a tangent face is not
 * counted, and the window starts above the throat so the retention detent —
 * which is deliberately tighter than the tab and paired with a relieved neck —
 * is not measured as obstruction.
 */
async function tabObstructionMm3(params: BinParams): Promise<{ mm3: number; envelopeMm3: number }> {
  const { box } = await import('brepjs');
  const mesh = generateBin(params);
  const bin = getLastSolid();
  if (!bin) throw new Error('expected a cached bin solid');

  const { slotDepth } = getEffectiveSlotDimensions(params);
  const outerW = params.width * params.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  const innerHalfW = outerW / 2 - params.wallThickness;
  const thickness = params.dividerPieces.thickness;

  const inset = 0.05;
  const xLo = innerHalfW + inset;
  const xHi = innerHalfW + slotDepth - inset;
  // `getLastSolid` is the translated solid, so these are world Z.
  const bb = boundingBox(mesh.vertices);
  const hasLip = params.base.stackingLip;
  const wallTopZ = bb.maxZ - (hasLip ? GRIDFINITY_SPEC.LIP_HEIGHT : 0);
  const zLo = wallTopZ - GRIDFINITY_SPEC.LIP_SMALL_TAPER + inset;
  const zHi = bb.maxZ + 0.1;

  const tab = box(xHi - xLo, thickness, zHi - zLo, {
    at: [(xLo + xHi) / 2, 0, (zLo + zHi) / 2],
  });
  try {
    return {
      mm3: await sharedVolume(bin, tab),
      envelopeMm3: (xHi - xLo) * thickness * (zHi - zLo),
    };
  } finally {
    tab.delete();
  }
}

describe('slotted bin with a stacking lip', () => {
  it('carries the divider pocket through the lip zone', async () => {
    const lipless = await tabObstructionMm3(slottedBin(false));
    const lipped = await tabObstructionMm3(slottedBin(true));

    // The lip adds ~4x the window, so a pass here is a real measurement of the
    // lip band and not a window that stops below it.
    expect(lipped.envelopeMm3).toBeGreaterThan(lipless.envelopeMm3 * 3);

    expect(lipless.mm3).toBeCloseTo(0, 3);
    expect(lipped.mm3).toBeCloseTo(lipless.mm3, 3);
  }, 300000);
});
