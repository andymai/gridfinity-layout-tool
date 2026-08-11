// @vitest-environment node
/**
 * Geometry validation for mount-down screw holes (#3425).
 *
 * Locks the two things a bounding box alone would not catch: that the plate
 * actually grows by the resolved pad when a screw falls back to the pocket
 * floor, and that a floor-sited screw does NOT floor every cell: only the ones
 * carrying a screw keep material, so the plate costs a few pads rather than a
 * full floor.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { ScrewHoleParams } from '@/core/types/baseplate';
import { mm } from '@/core/types';
import { screwPadThicknessMm } from '@/shared/generation/screwHolePlan';
import { SOCKET_HEIGHT } from './generatorTypes';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const NO_OP = (): void => {};

const SCREWS: ScrewHoleParams = {
  enabled: true,
  diameter: mm(3.4),
  headStyle: 'countersink',
};

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

describe('baseplate mount-down screw holes (#3425)', () => {
  it('generates a valid plate with floor-sited screws', () => {
    const pad = screwPadThicknessMm(SCREWS, 0);
    const result = getGenerateBaseplate()(
      defaults({ screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );
    assertStructurallyValid(result);
    expect(result.triangleCount).toBeGreaterThan(0);
  });

  it('grows the plate by exactly the resolved pad', () => {
    // A 2.3mm countersink cannot recess into a through-cut plate, so the slab
    // has to gain recess + retain before a floor screw is even possible.
    const pad = screwPadThicknessMm(SCREWS, 0);
    expect(pad).toBeCloseTo(3.1, 6);

    const plain = getGenerateBaseplate()(defaults(), NO_OP, true);
    const screwed = getGenerateBaseplate()(
      defaults({ screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );

    const plainZ = boundingBox(plain.vertices);
    const screwedZ = boundingBox(screwed.vertices);
    expect(plainZ.maxZ - plainZ.minZ).toBeCloseTo(SOCKET_HEIGHT, 1);
    expect(screwedZ.maxZ - screwedZ.minZ).toBeCloseTo(SOCKET_HEIGHT + pad, 1);
  });

  it('adds geometry rather than silently doing nothing', () => {
    const pad = screwPadThicknessMm(SCREWS, 0);
    const plain = getGenerateBaseplate()(defaults(), NO_OP, true);
    const screwed = getGenerateBaseplate()(
      defaults({ screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );
    expect(screwed.triangleCount).toBeGreaterThan(plain.triangleCount);
  });

  it('floors only the screw-bearing cells, not the whole plate', () => {
    // The distinguishing signal: a plate floored everywhere has far more
    // underside geometry than one where four pads sit in an otherwise
    // through-cut lattice. Compare against an explicit solid floor of the same
    // depth, which is the "floor every cell" shape.
    const pad = screwPadThicknessMm(SCREWS, 0);
    const screwed = getGenerateBaseplate()(
      defaults({ screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );
    const fullyFloored = getGenerateBaseplate()(
      defaults({ solidFloor: true, solidFloorThickness: pad }),
      NO_OP,
      true
    );
    expect(screwed.triangleCount).toBeGreaterThan(fullyFloored.triangleCount);
  });

  it('keeps screws in the margin when the padding is wide enough', () => {
    // A wide solid band hosts the head at full plate height, so the pad is zero
    // and the plate is exactly as tall as an unscrewed one.
    const padded = defaults({
      paddingLeft: 14,
      paddingRight: 14,
      paddingFront: 14,
      paddingBack: 14,
    });
    const result = getGenerateBaseplate()(
      { ...padded, screwHoles: SCREWS, screwPadThicknessMm: 0 },
      NO_OP,
      true
    );
    assertStructurallyValid(result);
    const bb = boundingBox(result.vertices);
    expect(bb.maxZ - bb.minZ).toBeCloseTo(SOCKET_HEIGHT, 1);
  });

  it('costs a magnet plate only the shortfall over its existing floor', () => {
    // The magnet floor already covers most of the recess, so the plate grows by
    // 0.6mm rather than 3.1mm.
    const magnetFloor = 0.5 + 2;
    const pad = screwPadThicknessMm(SCREWS, magnetFloor, { diameterMm: 6.5, depthMm: 2 });
    expect(pad).toBeCloseTo(0.6, 6);

    const result = getGenerateBaseplate()(
      defaults({
        magnetHoles: true,
        lightweight: true,
        screwHoles: SCREWS,
        screwPadThicknessMm: pad,
      }),
      NO_OP,
      true
    );
    assertStructurallyValid(result);
    const bb = boundingBox(result.vertices);
    expect(bb.maxZ - bb.minZ).toBeCloseTo(SOCKET_HEIGHT + magnetFloor + pad, 1);
  });
});
