// @vitest-environment node
/**
 * Geometry validation for per-side bin overhang (issue #1641).
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

    // Build all four combinations to isolate the scoop-delta under each condition.
    const base = generateBin(buildParams({ width: 2, depth: 2 }), undefined, true);
    const baseScoop = generateBin(
      buildParams({ width: 2, depth: 2, scoop: SCOOP }),
      undefined,
      true
    );
    const ovh = generateBin(buildParams({ width: 2, depth: 2, overhang: OVH }), undefined, true);
    const ovhScoop = generateBin(
      buildParams({ width: 2, depth: 2, scoop: SCOOP, overhang: OVH }),
      undefined,
      true
    );

    assertStructurallyValid(baseScoop, 'scoop no overhang');
    assertStructurallyValid(ovhScoop, 'scoop with overhang');

    // The scoop-delta is how many triangles the scoop adds to the plain shell.
    // Before the fix, innerD was nominal regardless of overhang, so both deltas
    // would be identical. After the fix, the overhang shell has a larger inner
    // cavity, so the scoop carves more geometry and its delta is different.
    const scoopDeltaNoOverhang = baseScoop.triangleCount - base.triangleCount;
    const scoopDeltaWithOverhang = ovhScoop.triangleCount - ovh.triangleCount;
    expect(scoopDeltaNoOverhang).toBeGreaterThan(0);
    expect(scoopDeltaWithOverhang).toBeGreaterThan(0);
    expect(scoopDeltaWithOverhang).not.toBe(scoopDeltaNoOverhang);
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
