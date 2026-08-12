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
import {
  assertStructurallyValid,
  boundingBox,
  isSolidThrough,
  verticalSolidSpans,
} from './__kernel-tests__/meshAssertions';
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

  it('cross-cuts a screw cell into corner boss pads instead of a full floor', () => {
    // With magnets off and lightweight on (the stored default), a screw cell's
    // floor is hollowed like a magnet plate's: corner pads survive, the cross
    // is void. Probed, not counted — a triangle count cannot tell a pad from a
    // membrane.
    // The export mesh sits bottom-at-Z=0 growing up and XY-centred, so every
    // band below derives from the bounding box rather than the BREP build's
    // top-at-0 convention.
    const pad = screwPadThicknessMm(SCREWS, 0);
    const result = getGenerateBaseplate()(
      defaults({ lightweight: true, screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );
    assertStructurallyValid(result);
    const bb = boundingBox(result.vertices);

    // Bottom-left screw cell: the screw snaps to the magnet position nearest
    // the plate corner, cell-local (-13, -13). The pad band around it spans
    // |8..18.05| on both axes (offset 13 − head r 4 − margin 1, relief
    // 21 − INSET_BOT). Probe just inside the pad, clear of the ø8 recess: the
    // pad slab spans the bottom `pad` mm of the plate.
    const cellCx = bb.minX + 21;
    const cellCy = bb.minY + 21;
    expect(
      isSolidThrough(result, cellCx - 9.75, cellCy - 9.75, bb.minZ + 0.02, bb.minZ + pad - 0.02)
    ).toBe(true);

    // The cross centre of the same cell is void top to bottom: the pocket sits
    // above the (removed) floor, so the ray misses the mesh entirely.
    expect(verticalSolidSpans(result, cellCx + 0.37, cellCy + 0.61)).toEqual([]);

    // A screwless cell has no floor at all — its would-be pad point is void.
    const midCx = bb.minX + 63;
    expect(verticalSolidSpans(result, midCx - 9.75, cellCy - 9.75)).toEqual([]);
  });

  it('keeps the full floor when lightweight is explicitly off', () => {
    const pad = screwPadThicknessMm(SCREWS, 0);
    const result = getGenerateBaseplate()(
      defaults({ lightweight: false, screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );
    const bb = boundingBox(result.vertices);
    expect(
      isSolidThrough(result, bb.minX + 21.37, bb.minY + 21.61, bb.minZ + 0.02, bb.minZ + pad - 0.02)
    ).toBe(true);
  });

  it('keeps the full floor in the draft fast path', () => {
    const pad = screwPadThicknessMm(SCREWS, 0);
    const result = getGenerateBaseplate()(
      defaults({ lightweight: true, screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true,
      undefined,
      true
    );
    const bb = boundingBox(result.vertices);
    expect(
      isSolidThrough(result, bb.minX + 21.37, bb.minY + 21.61, bb.minZ + 0.02, bb.minZ + pad - 0.02)
    ).toBe(true);
  });

  it('never intrudes into the bin-seating volume (whole-footprint sweep)', () => {
    // The top SOCKET_HEIGHT of the plate is where a bin's foot sits. Sweep the
    // whole footprint and require the screwed plate to carry no more solid in
    // that band than an unscrewed one anywhere — an aimed probe at a suspected
    // spot is exactly the check #3450 taught us not to trust. Each mesh's band
    // is measured from its own top: the screwed plate is `pad` taller, but the
    // socket is always its top SOCKET_HEIGHT.
    const pad = screwPadThicknessMm(SCREWS, 0);
    const plain = getGenerateBaseplate()(defaults({ lightweight: true }), NO_OP, true);
    const screwed = getGenerateBaseplate()(
      defaults({ lightweight: true, screwHoles: SCREWS, screwPadThicknessMm: pad }),
      NO_OP,
      true
    );
    const solidInSeatBand = (mesh: typeof plain, topZ: number, x: number, y: number): number => {
      const bandLo = topZ - SOCKET_HEIGHT + 0.05;
      const bandHi = topZ - 0.05;
      return verticalSolidSpans(mesh, x, y).reduce(
        (sum, [lo, hi]) => sum + Math.max(0, Math.min(hi, bandHi) - Math.max(lo, bandLo)),
        0
      );
    };
    const plainTop = boundingBox(plain.vertices).maxZ;
    const screwedTop = boundingBox(screwed.vertices).maxZ;

    const bb = boundingBox(plain.vertices);
    let worst = 0;
    let deepestSolid = 0;
    // 0.37/0.61 offsets keep sample columns off grid lines and face planes,
    // where the ray helper warns parity breaks.
    for (let x = bb.minX + 0.37; x < bb.maxX; x += 4.3) {
      for (let y = bb.minY + 0.61; y < bb.maxY; y += 4.3) {
        const inBand = solidInSeatBand(screwed, screwedTop, x, y);
        deepestSolid = Math.max(deepestSolid, inBand);
        worst = Math.max(worst, inBand - solidInSeatBand(plain, plainTop, x, y));
      }
    }
    expect(worst).toBeLessThanOrEqual(0.06);
    // Anti-vacuity: socket walls must register in the band, or the sweep is
    // silently probing air (which is how its first version passed).
    expect(deepestSolid).toBeGreaterThan(4);
  });

  it('opens magnet-plate cross voids through the deeper screw-pad floor (no sealed membrane)', () => {
    // A magnet+screw plate's floor is the magnet floor plus the pad shortfall.
    // The cross cut used to stop at the magnet floor, leaving a 0.6mm membrane
    // sealing every void from below; the ray at a cross centre must now miss
    // the mesh entirely.
    const magnetFloor = 0.5 + 2;
    const pad = screwPadThicknessMm(SCREWS, magnetFloor, { diameterMm: 6.5, depthMm: 2 });
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
    const bb = boundingBox(result.vertices);
    expect(verticalSolidSpans(result, bb.minX + 63.37, bb.minY + 63.61)).toEqual([]);
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
