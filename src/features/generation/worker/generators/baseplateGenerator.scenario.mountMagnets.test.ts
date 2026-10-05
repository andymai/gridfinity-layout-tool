// @vitest-environment node
/**
 * Geometry validation for underside mount magnets: the hole opens on the
 * bottom face at a four-pocket junction, stops at its depth, and leaves the
 * pockets around it intact. A triangle count alone would pass a hole cut from
 * the top or one that breaks into a pocket.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MountMagnetParams } from '@/core/types/baseplate';
import { mm } from '@/core/types';
import { PLATE_PROFILE_HEIGHT } from './generatorTypes';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};

const MAGNETS: MountMagnetParams = { enabled: true, diameter: mm(6.5), depth: mm(2.5) };

const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
  width: 3,
  depth: 3,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  lightweight: false,
  ...overrides,
});

/** Lowest surface over a column a little off the junction centre (no vertex hits). */
const lowestSurface = (mesh: Parameters<typeof columnCrossings>[0], x: number, y: number): number =>
  columnCrossings(mesh, x + 0.7, y + 0.4)[0];

describe('baseplate mount magnets', () => {
  it('opens a 2.5mm hole on the underside at each interior junction', () => {
    const plate = getGenerateBaseplate()(defaults({ mountMagnets: MAGNETS }), NO_OP, true);
    assertStructurallyValid(plate);
    assertWatertight(plate);

    for (const [x, y] of [
      [-21, -21],
      [21, -21],
      [-21, 21],
      [21, 21],
    ]) {
      expect(lowestSurface(plate, x, y)).toBeCloseTo(2.5, 2);
    }
  });

  it('keeps the plate height: the holes are inside the existing slab', () => {
    const plate = getGenerateBaseplate()(defaults({ mountMagnets: MAGNETS }), NO_OP, true);
    const bb = boundingBox(plate.vertices);
    expect(bb.maxZ - bb.minZ).toBeCloseTo(PLATE_PROFILE_HEIGHT, 2);
  });

  it('leaves the plate edge and junction-free columns solid to the bottom', () => {
    const plate = getGenerateBaseplate()(defaults({ mountMagnets: MAGNETS }), NO_OP, true);
    expect(lowestSurface(plate, -21, -63)).toBeCloseTo(0, 2);
    expect(lowestSurface(plate, 0, -21)).toBeCloseTo(0, 2);
  });

  it('places one magnet at the centre junction when asked for one', () => {
    const plate = getGenerateBaseplate()(
      defaults({ width: 4, depth: 4, mountMagnets: { ...MAGNETS, perPiece: 1 } }),
      NO_OP,
      true
    );
    expect(lowestSurface(plate, 0, 0)).toBeCloseTo(2.5, 2);
    expect(lowestSurface(plate, 42, 42)).toBeCloseTo(0, 2);
  });

  it('cuts into the magnet floor of a floored plate', () => {
    const plate = getGenerateBaseplate()(
      defaults({ magnetHoles: true, lightweight: true, mountMagnets: MAGNETS }),
      NO_OP,
      true
    );
    assertStructurallyValid(plate);
    assertWatertight(plate);
    expect(lowestSurface(plate, 21, 21)).toBeCloseTo(2.5, 2);
  });

  it('widens the mouth by the 45 degree chamfer when asked', () => {
    const plain = getGenerateBaseplate()(defaults({ mountMagnets: MAGNETS }), NO_OP, true);
    const chamfered = getGenerateBaseplate()(
      defaults({ mountMagnets: { ...MAGNETS, chamfer: true } }),
      NO_OP,
      true
    );
    assertStructurallyValid(chamfered);
    assertWatertight(chamfered);
    // 0.35mm outside the 3.25mm bore: solid to the bottom without the chamfer,
    // and on the 45 degree lead-in (0.8 - 0.35 above the bottom) with it.
    const px = 21 + 3.6 * Math.cos(0.7);
    const py = 21 + 3.6 * Math.sin(0.7);
    expect(columnCrossings(plain, px, py)[0]).toBeCloseTo(0, 2);
    expect(columnCrossings(chamfered, px, py)[0]).toBeCloseTo(0.45, 1);
    expect(lowestSurface(chamfered, 21, 21)).toBeCloseTo(2.5, 2);
  });

  it('keeps the chamfer on a lightweight magnet plate, whose pads guard the junction', () => {
    const plate = getGenerateBaseplate()(
      defaults({
        magnetHoles: true,
        lightweight: true,
        mountMagnets: { ...MAGNETS, chamfer: true },
      }),
      NO_OP,
      true
    );
    assertStructurallyValid(plate);
    assertWatertight(plate);
    const px = 21 + 3.6 * Math.cos(0.7);
    const py = 21 + 3.6 * Math.sin(0.7);
    expect(columnCrossings(plate, px, py)[0]).toBeCloseTo(0.45, 1);
  });

  it('cuts nothing on a low-profile plate the hole would break through', () => {
    const plain = getGenerateBaseplate()(defaults({ lowProfileBase: true }), NO_OP, true);
    const plate = getGenerateBaseplate()(
      defaults({ lowProfileBase: true, mountMagnets: MAGNETS }),
      NO_OP,
      true
    );
    expect(lowestSurface(plate, 21, 21)).toBeCloseTo(0, 2);
    expect(plate.triangleCount).toBe(plain.triangleCount);
  });
});
