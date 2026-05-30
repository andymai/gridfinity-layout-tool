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
