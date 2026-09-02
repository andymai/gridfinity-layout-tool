// @vitest-environment node
/**
 * Geometry validation for per-side bin overhang.
 *
 * Overhang grows the outer body + stacking lip outward by a per-side mm amount
 * while the base sockets stay at the nominal footprint (flat bottom under the
 * overhang). These tests assert the resulting AABB grows by the expected amount
 * on the expected sides, that the bottom doesn't drop (feet unchanged), and
 * that the mesh stays structurally valid.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { assertStructurallyValid, boundingBox } from './__kernel-tests__/meshAssertions';
import { deriveDimensions } from './pipeline/context';
import {
  computeInteriorHeight,
  computeLipOffset,
  resolveScoopProfile,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import { LIP_SMALL_TAPER, LIP_TAPER_WIDTH } from './generatorConstants';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

describe('bin overhang geometry', () => {
  it('symmetric overhang grows width and depth by left+right / front+back', () => {
    const generateBin = getGenerateBin();
    const base = boundingBox(
      generateBin(buildParams({ width: 2, depth: 2 }), undefined, true).vertices
    );

    const result = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { left: 5, right: 5, front: 4, back: 4 } }),
      undefined,
      true
    );
    assertStructurallyValid(result, 'symmetric overhang');
    const bb = boundingBox(result.vertices);

    expect(bb.maxX - bb.minX).toBeCloseTo(base.maxX - base.minX + 10, 1);
    expect(bb.maxY - bb.minY).toBeCloseTo(base.maxY - base.minY + 8, 1);
    // Symmetric -> stays centered on X/Y
    expect((bb.maxX + bb.minX) / 2).toBeCloseTo((base.maxX + base.minX) / 2, 1);
    // Feet unchanged -> bottom does not drop
    expect(bb.minZ).toBeCloseTo(base.minZ, 1);
    // Height unchanged
    expect(bb.maxZ - bb.minZ).toBeCloseTo(base.maxZ - base.minZ, 1);
  });

  it('single-side overhang extends only that side', () => {
    const generateBin = getGenerateBin();
    const base = boundingBox(
      generateBin(buildParams({ width: 3, depth: 2 }), undefined, true).vertices
    );

    const result = generateBin(
      buildParams({ width: 3, depth: 2, overhang: { left: 0, right: 6, front: 0, back: 0 } }),
      undefined,
      true
    );
    assertStructurallyValid(result, 'right-only overhang');
    const bb = boundingBox(result.vertices);

    // +X edge pushes out by 6mm; -X edge unchanged
    expect(bb.maxX).toBeCloseTo(base.maxX + 6, 1);
    expect(bb.minX).toBeCloseTo(base.minX, 1);
    // Depth unchanged
    expect(bb.maxY - bb.minY).toBeCloseTo(base.maxY - base.minY, 1);
  });

  it('clamps negative overhang to zero (no change)', () => {
    const generateBin = getGenerateBin();
    const base = boundingBox(
      generateBin(buildParams({ width: 2, depth: 2 }), undefined, true).vertices
    );

    const result = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { left: -5, right: -5, front: -5, back: -5 } }),
      undefined,
      true
    );
    const bb = boundingBox(result.vertices);
    expect(bb.maxX - bb.minX).toBeCloseTo(base.maxX - base.minX, 1);
    expect(bb.maxY - bb.minY).toBeCloseTo(base.maxY - base.minY, 1);
  });
});

describe('overhang with interior features', () => {
  it('scoop ramp uses expanded interior space (regression: innerD was not including overhang)', () => {
    const generateBin = getGenerateBin();
    const SCOOP = { enabled: true as const, radius: 'auto' as const };
    const OVH = { left: 5, right: 5, front: 5, back: 5 };
    const params = buildParams({ width: 2, depth: 2, scoop: SCOOP, overhang: OVH });
    const ovhScoop = generateBin(params, undefined, true);
    assertStructurallyValid(ovhScoop, 'scoop with overhang');

    // The ramp's top edge runs along the front wall at the lip offset, one
    // ramp-height above the floor. The overhang deepens the cavity by 5mm each
    // way, so that edge must sit at the EXPANDED wall; a ramp sized for the
    // nominal cavity would float 5mm inboard of the real wall, and the nominal
    // position would carry its top edge instead.
    const dim = deriveDimensions(params, true);
    const lipOffset = computeLipOffset(dim.hasLip, true, LIP_TAPER_WIDTH, params.wallThickness);
    const frame = scoopFrameHeights(
      dim.wallHeight,
      computeInteriorHeight(dim.wallHeight, dim.hasLip, LIP_SMALL_TAPER),
      dim.floorThickness
    );
    const profile = resolveScoopProfile(
      params.scoop,
      dim.innerW,
      dim.innerD,
      true,
      dim.hasLip,
      frame.wallHeight,
      frame.interiorHeight,
      lipOffset
    );
    expect(profile).not.toBeNull();
    if (!profile) return;
    const topZ = dim.baseOffsetZ + dim.floorThickness + profile.height;
    const expandedWallY = -dim.innerD / 2;
    const nominalWallY = expandedWallY + OVH.front;
    const { vertices } = ovhScoop;
    const hasTopEdgeAt = (y: number): boolean => {
      for (let i = 0; i < vertices.length; i += 3) {
        if (
          Math.abs(vertices[i + 1] - y) < 0.05 &&
          Math.abs(vertices[i + 2] - topZ) < 0.05 &&
          Math.abs(vertices[i]) <= dim.innerW / 2 + 0.1
        ) {
          return true;
        }
      }
      return false;
    };
    expect(hasTopEdgeAt(expandedWallY + lipOffset)).toBe(true);
    expect(hasTopEdgeAt(nominalWallY + lipOffset)).toBe(false);
  });

  it('asymmetric overhang: interior features are structurally valid (centering offset applied)', () => {
    const generateBin = getGenerateBin();
    // right-only overhang: cavity centre shifts +X by 5mm (offsetX = 5).
    // Before the centering fix, scoops would extend 5mm into the left wall.
    // After the fix, all features translate by (innerOffsetX, innerOffsetY).
    const result = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        overhang: { left: 0, right: 10, front: 0, back: 0 },
        scoop: { enabled: true, radius: 'auto' },
      }),
      undefined,
      true
    );
    assertStructurallyValid(result, 'asymmetric overhang with scoop');

    // front-only overhang: cavity centre shifts +Y by 5mm (offsetY = 5).
    const result2 = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        overhang: { left: 0, right: 0, front: 0, back: 10 },
        scoop: { enabled: true, radius: 'auto' },
      }),
      undefined,
      true
    );
    assertStructurallyValid(result2, 'back-only overhang with scoop');
  });
});

describe('overhang feet toggle', () => {
  const OVERHANG = { left: 12, right: 12, front: 12, back: 12 };

  it('adds grid-aligned feet under the overhang without dropping the bottom', () => {
    const generateBin = getGenerateBin();
    const flat = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...OVERHANG, feet: false } }),
      undefined,
      true
    );
    const withFeet = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...OVERHANG, feet: true } }),
      undefined,
      true
    );
    assertStructurallyValid(withFeet, 'overhang feet');

    const flatBB = boundingBox(flat.vertices);
    const feetBB = boundingBox(withFeet.vertices);
    // Same outer body footprint + bottom (feet don't drop below the nominal feet)
    expect(feetBB.maxX - feetBB.minX).toBeCloseTo(flatBB.maxX - flatBB.minX, 1);
    expect(feetBB.minZ).toBeCloseTo(flatBB.minZ, 1);
    // Frame feet add geometry under the overhang strips/corners.
    expect(withFeet.triangleCount).toBeGreaterThan(flat.triangleCount);
  });

  it('drops sub-threshold overhang strips (no feet, equals flat bottom)', () => {
    const generateBin = getGenerateBin();
    // 3mm per side is below the printable foot threshold → no frame feet.
    const tiny = { left: 3, right: 3, front: 3, back: 3 };
    const flat = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...tiny, feet: false } }),
      undefined,
      true
    );
    const withFeet = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...tiny, feet: true } }),
      undefined,
      true
    );
    expect(withFeet.triangleCount).toBe(flat.triangleCount);
  });
});
