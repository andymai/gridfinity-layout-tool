/**
 * Bin lip dip scenario tests.
 *
 * The dip removes part of a load-bearing interface, so what matters is where
 * it stops: at the wall top, at the enabled walls, and nowhere near a design
 * that did not ask for it.
 *
 * Two probing approaches were tried and rejected, both worth recording:
 * `verticalSolidSpans` pairs ray/surface crossings by parity, and the faces a
 * boolean cut introduces defeat it — the dipped mesh reports a solid span
 * where the undipped one reports none, which a cut cannot produce. Slicing
 * triangle edges at a plane fails differently: a flat wall face is two large
 * triangles with no interior edges, so a query windowed to the middle of a
 * wall finds nothing to slice.
 *
 * What is used instead is parity-free and tessellation-independent: counting
 * vertices inside the box the dip occupies (a cut always leaves vertices on
 * the faces it creates), and `meshVolume` over the whole surface.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidGripDip.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { resolveLidGripSpanMm } from '@/shared/types/bin';
import { resolveLidInputs } from './lidInputs';
import type { BinParams, LidGripConfig } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';
import type { CellMask } from '@/shared/utils/cellMask';

const DIMS = { width: 3, depth: 2, height: 4 } as const;

function makeParams(grip: Partial<LidGripConfig>): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...DIMS,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      // Off, because this file probes a coarse box — the flare's thickness by
      // the lip's height on one wall — and's relief ring puts its top
      // edge inside that box while touching nothing the dip cares about. The
      // subject here is the lip, so the interior is held still.
      relieveInterior: false,
      grip: {
        ...DEFAULT_BIN_PARAMS.lid.grip,
        sides: { front: true, back: true, left: false, right: false },
        ...grip,
      },
    },
  };
}

/**
 * Half-width of the window every box below uses.
 *
 * Wide enough to contain the dip's own vertices — a planar cut face carries
 * them only at its corners, so a window narrower than the span plus its ramps
 * finds nothing even where the cut plainly happened — and still far short of
 * the wall's ends, so corner geometry never leaks in.
 */
const WINDOW_X = 25;

/** Axis-aligned region of interest. */
interface Box {
  readonly xLimit: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
  readonly zMax: number;
}

/**
 * How many mesh vertices fall inside `box`.
 *
 * A boolean cut always leaves vertices on the faces it creates, so this
 * separates "the dip cut here" from "the dip did not" without depending on
 * ray parity or on where the tessellator happened to place an edge.
 */
function verticesInBox({ vertices }: MeshData, box: Box): number {
  let count = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    if (Math.abs(x) > box.xLimit) continue;
    if (y < box.yMin || y > box.yMax) continue;
    if (z < box.zMin || z > box.zMax) continue;
    count++;
  }
  return count;
}

const DIPPED = makeParams({ mode: 'scallop', binDip: true });
const UNDIPPED = makeParams({ mode: 'scallop', binDip: false });
const PLAIN = makeParams({ mode: 'none', binDip: false });

beforeAll(async () => {
  await initBrepjs();
}, 120000);

describe('bin lip dip', () => {
  it('leaves the bin untouched when binDip is off', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const relief = generateBin(UNDIPPED);
    const plain = generateBin(PLAIN);
    // A relief on the LID must not change the BIN at all.
    expect(relief.indices.length).toBe(plain.indices.length);
    expect(relief.vertices.length).toBe(plain.vertices.length);
  });

  it('cuts into the lip over the span, on the enabled wall only', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const dipped = generateBin(DIPPED);
    const undipped = generateBin(UNDIPPED);
    assertStructurallyValid(dipped, 'dipped bin');
    assertWatertight(dipped, 'dipped bin');

    const bb = boundingBox(undipped.vertices);
    // The volume the dip is allowed to occupy on the BACK wall: the flare's
    // thickness, the lip's height, and the middle of the span.
    const backLip: Box = {
      xLimit: WINDOW_X,
      yMin: bb.maxY - LIP_TAPER_WIDTH,
      yMax: bb.maxY,
      zMin: bb.maxZ - LIP_HEIGHT,
      zMax: bb.maxZ,
    };
    expect(verticesInBox(undipped, backLip)).toBe(0);
    expect(verticesInBox(dipped, backLip)).toBeGreaterThan(0);
  });

  it('leaves the lip alone on a wall the user did not enable', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const backOnly = generateBin(
      makeParams({
        mode: 'scallop',
        binDip: true,
        sides: { front: false, back: true, left: false, right: false },
      })
    );
    const bb = boundingBox(generateBin(UNDIPPED).vertices);
    const frontLip: Box = {
      xLimit: WINDOW_X,
      yMin: bb.minY,
      yMax: bb.minY + LIP_TAPER_WIDTH,
      zMin: bb.maxZ - LIP_HEIGHT,
      zMax: bb.maxZ,
    };
    expect(verticesInBox(backOnly, frontLip)).toBe(0);
  });

  it('stops at the wall top', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const dipped = generateBin(DIPPED);
    const undipped = generateBin(UNDIPPED);
    const bb = boundingBox(undipped.vertices);
    // Below the lip the wall already carries vertices of its own, so the
    // assertion is that the dip ADDS none: a dip that ran on down would be
    // eating the wall rather than the lip.
    const belowLip: Box = {
      xLimit: WINDOW_X,
      yMin: bb.maxY - LIP_TAPER_WIDTH,
      yMax: bb.maxY,
      zMin: bb.maxZ - LIP_HEIGHT - 3,
      zMax: bb.maxZ - LIP_HEIGHT - 0.5,
    };
    expect(verticesInBox(dipped, belowLip)).toBe(verticesInBox(undipped, belowLip));
  });

  it('removes about the volume the dip describes, per enabled side', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const undipped = meshVolume(generateBin(UNDIPPED));
    const oneSide = meshVolume(
      generateBin(
        makeParams({
          mode: 'scallop',
          binDip: true,
          sides: { front: false, back: true, left: false, right: false },
        })
      )
    );
    const twoSides = meshVolume(generateBin(DIPPED));

    const removedOne = undipped - oneSide;
    const removedTwo = undipped - twoSides;
    expect(removedOne).toBeGreaterThan(0);
    // Two sides remove twice what one does — the sides are independent and
    // neither leaks onto the other.
    expect(removedTwo / removedOne).toBeCloseTo(2, 1);

    // Bounded by the box the dip is cut from; the 45° end ramps leave some of
    // that box behind, so the actual removal is a fraction of it. The span is
    // read from the resolver rather than restated — on a 3-wide wall the 40mm
    // cap binds, which a hand-written number got wrong by 15%.
    const inputs = resolveLidInputs(DIPPED);
    const span = resolveLidGripSpanMm(
      inputs.lidOuterW - 2 * inputs.lidCornerR,
      inputs.grip.coverage
    );
    const boxVolume = span * LIP_HEIGHT * LIP_TAPER_WIDTH;
    expect(removedOne).toBeLessThan(boxVolume);
    expect(removedOne).toBeGreaterThan(boxVolume * 0.5);
  });
});

describe('bin lip dip gating', () => {
  /**
   * The dip changes the BIN, so it has to answer to the same question the
   * magnet pads do: is a lid actually being built? `hasBinLipDip` only knows
   * about the relief's own settings.
   */
  it('does not cut the lip when the lid is disabled', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const params = makeParams({ mode: 'scallop', binDip: true });
    const lidOff = generateBin({ ...params, lid: { ...params.lid, enabled: false } });
    const plain = generateBin({ ...PLAIN, lid: { ...PLAIN.lid, enabled: false } });
    expect(lidOff.vertices.length).toBe(plain.vertices.length);
  });

  it('does not cut the lip when the bin has no stacking lip to dip', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const base = { ...DEFAULT_BIN_PARAMS.base, stackingLip: false };
    const params = makeParams({ mode: 'scallop', binDip: true });
    const noLip = generateBin({ ...params, base });
    const plain = generateBin({ ...PLAIN, base });
    expect(noLip.vertices.length).toBe(plain.vertices.length);
  });
});

describe('bin lip dip face provenance', () => {
  /**
   * `setShapeOrigin` REPLACES a shape's whole face-origin map, so tagging the
   * post-boolean solid would stamp the entire bin `LID_GRIP` — taking `LIP`
   * with it, which is the only key the per-cell multicolour lip is built from.
   * The cutters carry the tag instead.
   */
  it('leaves the bin’s other feature tags intact', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const tags = (mesh: MeshData): Set<number> =>
      new Set((mesh.faceGroups ?? []).map((g) => g.tag));

    const plainTags = tags(generateBin(UNDIPPED));
    const dippedTags = tags(generateBin(DIPPED));

    expect(plainTags.size).toBeGreaterThan(0);
    for (const tag of plainTags) {
      expect(dippedTags.has(tag), `tag ${tag} was wiped by the dip`).toBe(true);
    }
  });
});

describe('bin lip dip across base styles', () => {
  /**
   * The lip's Z is `baseOffsetZ + wallHeight + collarHeight`,
   * and `baseOffsetZ + totalHeight` is a different number on every one of
   * these: 0.7mm high on a standard bin, 4.3mm low on a flat one, 8.3mm low
   * with a collar. Low enough and the cutter is inside the WALL, where
   * `LIP_TAPER_WIDTH` of depth against a 1.2mm wall opens a slot into the
   * cavity — and leaves the mesh watertight, so only this probe finds it.
   */
  const STYLES = [
    { name: 'standard socket', over: {} as Partial<BinParams> },
    {
      name: 'flat base',
      over: { base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, style: 'flat' as const } },
    },
    { name: 'wall collar', over: { extraWallHeightMm: 9 } as Partial<BinParams> },
  ];

  for (const style of STYLES) {
    it(`cuts the lip and not the wall on a ${style.name}`, async () => {
      const { generateBin } = await import('./binOrchestrator');
      const dipped = generateBin({ ...DIPPED, ...style.over });
      const undipped = generateBin({ ...UNDIPPED, ...style.over });
      assertWatertight(dipped, style.name);

      const bb = boundingBox(undipped.vertices);
      const lip: Box = {
        xLimit: WINDOW_X,
        yMin: bb.maxY - LIP_TAPER_WIDTH,
        yMax: bb.maxY,
        zMin: bb.maxZ - LIP_HEIGHT,
        zMax: bb.maxZ,
      };
      const wall: Box = {
        xLimit: WINDOW_X,
        yMin: bb.maxY - LIP_TAPER_WIDTH,
        yMax: bb.maxY,
        zMin: bb.maxZ - LIP_HEIGHT - 4,
        zMax: bb.maxZ - LIP_HEIGHT - 0.5,
      };

      // Cut lands in the lip band...
      expect(verticesInBox(dipped, lip)).toBeGreaterThan(0);
      // ...and adds nothing below it.
      expect(verticesInBox(dipped, wall)).toBe(verticesInBox(undipped, wall));
    });
  }
});

describe('bin lip dip on other lid variants', () => {
  it('reaches the bin face on a magnetic lid, whose footprint is inboard of it', async () => {
    const { generateBin } = await import('./binOrchestrator');
    const magnetic = (binDip: boolean): BinParams => {
      const base = makeParams({ mode: 'scallop', binDip });
      return { ...base, lid: { ...base.lid, attachment: 'magnetic' } };
    };
    const dipped = generateBin(magnetic(true));
    const undipped = generateBin(magnetic(false));
    assertWatertight(dipped, 'magnetic dipped bin');

    // The cutter is placed on the LID's perimeter, which sits
    // LID_MAGNETIC_EXTRA_CLEARANCE inboard of the bin's here. If its outward
    // overshoot did not cover that, a skin of lip would survive and the volume
    // removed would fall short.
    const removed = meshVolume(undipped) - meshVolume(dipped);
    const span = resolveLidGripSpanMm(
      resolveLidInputs(magnetic(true)).lidOuterW - 2 * resolveLidInputs(magnetic(true)).lidCornerR,
      DEFAULT_BIN_PARAMS.lid.grip.coverage
    );
    expect(removed).toBeGreaterThan(span * LIP_HEIGHT * LIP_TAPER_WIDTH * 0.5);
  });

  it('dips a polygon footprint', async () => {
    const { generateBin } = await import('./binOrchestrator');
    // 3x3 L-shape, top-right unit removed.
    const cellMask: CellMask = {
      cols: 6,
      rows: 6,
      cells: [
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1,
        1, 1, 1, 0, 0,
      ],
    };
    const poly = (binDip: boolean): BinParams => ({
      ...makeParams({ mode: 'scallop', binDip }),
      width: 3,
      depth: 3,
      cellMask,
    });
    const dipped = generateBin(poly(true));
    assertWatertight(dipped, 'polygon dipped bin');
    expect(meshVolume(generateBin(poly(false))) - meshVolume(dipped)).toBeGreaterThan(0);
  });
});
