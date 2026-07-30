// @vitest-environment node
/**
 * Geometry validation for the bottom-band outer-wall taper (#2933).
 *
 * The taper insets the outer wall *within the overhang region* — from the
 * overhang-expanded rim down to (at most) the nominal footprint at the base — so
 * the rim envelope is unchanged, the base is inset (less material), and the feet
 * never drop. These tests assert the export mesh stays structurally valid for
 * both chamfer and fillet, that the outer envelope matches the untapered
 * overhang bin, that the taper removes material, and that a taper with no
 * overhang is a no-op (the clamp keeps the base from going below nominal).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  assertStructurallyValid,
  boundingBox,
  meshTopologyStats,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const OVH = { left: 10, right: 10, front: 10, back: 10 };

describe('bin wall taper geometry (#2933)', () => {
  it('chamfer: valid, rim envelope unchanged, bottom held, less material than flat overhang', () => {
    const generateBin = getGenerateBin();
    const flat = generateBin(buildParams({ width: 2, depth: 2, overhang: OVH }), undefined, true);
    const tapered = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        overhang: {
          ...OVH,
          taper: { profile: 'chamfer', bandHeight: 8, left: 10, right: 10, front: 10, back: 10 },
        },
      }),
      undefined,
      true
    );
    assertStructurallyValid(tapered, 'chamfer taper');

    const flatBB = boundingBox(flat.vertices);
    const tapBB = boundingBox(tapered.vertices);
    // Rim is full-size → outer envelope and height match the untapered overhang bin.
    expect(tapBB.maxX - tapBB.minX).toBeCloseTo(flatBB.maxX - flatBB.minX, 1);
    expect(tapBB.maxY - tapBB.minY).toBeCloseTo(flatBB.maxY - flatBB.minY, 1);
    expect(tapBB.maxZ - tapBB.minZ).toBeCloseTo(flatBB.maxZ - flatBB.minZ, 1);
    // Feet unchanged → bottom does not drop.
    expect(tapBB.minZ).toBeCloseTo(flatBB.minZ, 1);
    // The taper carves a wedge out of the base → strictly less material.
    expect(meshVolume(tapered)).toBeLessThan(meshVolume(flat));
  });

  it('fillet: valid and removes material', () => {
    const generateBin = getGenerateBin();
    const flat = generateBin(buildParams({ width: 2, depth: 2, overhang: OVH }), undefined, true);
    const fillet = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        overhang: {
          ...OVH,
          taper: { profile: 'fillet', bandHeight: 8, left: 10, right: 10, front: 10, back: 10 },
        },
      }),
      undefined,
      true
    );
    assertStructurallyValid(fillet, 'fillet taper');
    expect(meshVolume(fillet)).toBeLessThan(meshVolume(flat));
  });

  it('fillet: a tall band does not breach the wall just above the floor', () => {
    const generateBin = getGenerateBin();
    const ovh = { left: 21, right: 0, front: 0, back: 0 };
    const flat = generateBin(
      buildParams({ width: 2, depth: 2, height: 5, overhang: ovh }),
      undefined,
      true
    );
    const tall = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        height: 5,
        overhang: {
          ...ovh,
          taper: { profile: 'fillet', bandHeight: 30, left: 21, right: 0, front: 0, back: 0 },
        },
      }),
      undefined,
      true
    );
    assertStructurallyValid(tall, 'tall fillet');
    const topology = meshTopologyStats(tall);
    // Closed first — the Euler count below only means "same topology as the
    // untapered bin" if the surface is actually closed and manifold.
    expect(topology.boundaryEdges).toBe(0);
    expect(topology.nonManifoldEdges).toBe(0);
    // The cavity loft is sampled at the floor plane where the outer loft only
    // has a chord; on a concave profile the chord falls inside the true curve,
    // so a coarse band let the cavity cut a slot clean through the wall.
    expect(topology.eulerCharacteristic).toBe(meshTopologyStats(flat).eulerCharacteristic);
  });

  it('asymmetric taper (drawer-facing sides only) stays valid and removes material', () => {
    const generateBin = getGenerateBin();
    const flat = generateBin(
      buildParams({ width: 3, depth: 2, overhang: { left: 0, right: 12, front: 0, back: 12 } }),
      undefined,
      true
    );
    const tapered = generateBin(
      buildParams({
        width: 3,
        depth: 2,
        overhang: {
          left: 0,
          right: 12,
          front: 0,
          back: 12,
          taper: { profile: 'chamfer', bandHeight: 7, left: 0, right: 12, front: 0, back: 12 },
        },
      }),
      undefined,
      true
    );
    assertStructurallyValid(tapered, 'asymmetric taper');
    expect(meshVolume(tapered)).toBeLessThan(meshVolume(flat));
  });

  it('taper is clamped to overhang: with no overhang it is a no-op (base never below nominal)', () => {
    const generateBin = getGenerateBin();
    const plain = generateBin(buildParams({ width: 2, depth: 2 }), undefined, true);
    const taperNoOverhang = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        overhang: {
          left: 0,
          right: 0,
          front: 0,
          back: 0,
          taper: { profile: 'chamfer', bandHeight: 8, left: 10, right: 10, front: 10, back: 10 },
        },
      }),
      undefined,
      true
    );
    // Clamped to zero overhang → identical geometry to the plain bin.
    expect(taperNoOverhang.triangleCount).toBe(plain.triangleCount);
    expect(meshVolume(taperNoOverhang)).toBeCloseTo(meshVolume(plain), 3);
  });

  // The multi-cavity path cuts compartments out of a lofted outer instead of a
  // prism (#3017). Each compartment is clipped to the inner envelope first —
  // below the band a rim-sized prism spans the whole wall thickness, so an
  // unclipped cut would open a slot straight through the wall.
  it('applies to a multi-compartment bin without breaching the wall', () => {
    const generateBin = getGenerateBin();
    const compartments = { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] };
    const noTaper = generateBin(
      buildParams({ width: 2, depth: 2, overhang: OVH, compartments }),
      undefined,
      true
    );
    const withTaper = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        overhang: {
          ...OVH,
          taper: { profile: 'chamfer', bandHeight: 8, left: 10, right: 10, front: 10, back: 10 },
        },
        compartments,
      }),
      undefined,
      true
    );
    assertStructurallyValid(withTaper, 'tapered multi-compartment');
    // The taper now does something rather than silently no-opping.
    expect(meshVolume(withTaper)).toBeLessThan(meshVolume(noTaper));

    const topology = meshTopologyStats(withTaper);
    expect(topology.boundaryEdges).toBe(0);
    expect(topology.nonManifoldEdges).toBe(0);
    // A slot through the wall leaves the surface closed, so only the Euler
    // count catches it.
    expect(topology.eulerCharacteristic).toBe(meshTopologyStats(noTaper).eulerCharacteristic);
  });

  it('applies to a fillet multi-compartment grid without breaching the wall', () => {
    const generateBin = getGenerateBin();
    const compartments = {
      ...DEFAULT_BIN_PARAMS.compartments,
      cols: 2,
      rows: 2,
      cells: [0, 1, 2, 3],
    };
    const noTaper = generateBin(
      buildParams({ width: 2, depth: 2, height: 5, overhang: OVH, compartments }),
      undefined,
      true
    );
    const withTaper = generateBin(
      buildParams({
        width: 2,
        depth: 2,
        height: 5,
        overhang: {
          ...OVH,
          taper: { profile: 'fillet', bandHeight: 25, left: 10, right: 10, front: 10, back: 10 },
        },
        compartments,
      }),
      undefined,
      true
    );
    assertStructurallyValid(withTaper, 'tapered 2x2 fillet');
    expect(meshVolume(withTaper)).toBeLessThan(meshVolume(noTaper));
    const topology = meshTopologyStats(withTaper);
    expect(topology.boundaryEdges).toBe(0);
    expect(topology.nonManifoldEdges).toBe(0);
    expect(topology.eulerCharacteristic).toBe(meshTopologyStats(noTaper).eulerCharacteristic);
  });

  // Cutouts are cut from the wall top down, the taper band rises from the
  // floor, so only a deep cutout reaches into the non-vertical stretch. That
  // overlap is the case worth pinning: the wall it cuts is a loft, not a prism.
  it('deep wall cutouts survive a tapered wall', () => {
    const generateBin = getGenerateBin();
    const walls = {
      ...DEFAULT_BIN_PARAMS.walls,
      enabled: true,
      left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true, width: 70, depth: 90 },
      right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: true, width: 70, depth: 90 },
    };
    const taper = {
      profile: 'chamfer' as const,
      bandHeight: 20,
      left: 10,
      right: 10,
      front: 10,
      back: 10,
    };
    const noCutout = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...OVH, taper } }),
      undefined,
      true
    );
    const cutout = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...OVH, taper }, walls }),
      undefined,
      true
    );
    assertStructurallyValid(cutout, 'tapered bin with deep wall cutouts');
    expect(meshVolume(cutout)).toBeLessThan(meshVolume(noCutout));
  });

  // Overhang feet frame the region under the wall. On a tapered bin the wall at
  // the floor is `flare` mm narrower than at the rim, so feet framed from the
  // rim would jut out past it. The bounding box can't see that (the rim is the
  // widest part either way) — measure the footprint at the floor instead.
  it('overhang feet are framed from the base, not the rim', () => {
    const generateBin = getGenerateBin();
    const taper = {
      profile: 'chamfer' as const,
      bandHeight: 12,
      left: 10,
      right: 10,
      front: 10,
      back: 10,
    };
    const feetFlat = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...OVH, feet: true } }),
      undefined,
      true
    );
    const feetTapered = generateBin(
      buildParams({ width: 2, depth: 2, overhang: { ...OVH, feet: true, taper } }),
      undefined,
      true
    );
    assertStructurallyValid(feetTapered, 'overhang feet + taper');

    // Span across vertices on the floor plane. Measured as a difference between
    // the two bins so the gridfinity foot's own bottom chamfer cancels out.
    const floorSpanX = ({ vertices }: { vertices: Float32Array }): number => {
      const minZ = boundingBox(vertices).minZ;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < vertices.length; i += 3) {
        if (Math.abs(vertices[i + 2] - minZ) > 0.05) continue;
        lo = Math.min(lo, vertices[i]);
        hi = Math.max(hi, vertices[i]);
      }
      return hi - lo;
    };

    // The taper fully retracts both X sides, so the tapered bin's feet stop a
    // full 10mm/side short of where the flat bin's reach.
    expect(floorSpanX(feetFlat) - floorSpanX(feetTapered)).toBeCloseTo(taper.left + taper.right, 0);
  });
});
