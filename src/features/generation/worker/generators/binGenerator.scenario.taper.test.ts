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

  it('is a no-op on a multi-compartment bin (v1 scope: single-cavity only)', () => {
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
    // Taper is stripped for multi-compartment bins → identical geometry.
    expect(meshVolume(withTaper)).toBeCloseTo(meshVolume(noTaper), 3);
  });
});
