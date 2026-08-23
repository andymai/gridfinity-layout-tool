// @vitest-environment node
/**
 * Geometry validation for non-rectangular compartments (#3748).
 *
 * Divider walls fall out of the boundaries between differing cell IDs, so a
 * group of cells in an L, S, T or U prints as one pocket with no wall inside
 * it. These tests pin that the mesh stays closed and that the walls really are
 * gone — a merge that produced the same volume as the unmerged grid would mean
 * the shape never reached the builder.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import {
  assertStructurallyValid,
  meshTopologyStats,
  meshVolume,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const grid = (cols: number, rows: number, cells: number[]) =>
  buildParams({
    width: 2,
    depth: 2,
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols, rows, cells },
  });

describe('non-rectangular compartments (#3748)', () => {
  it('builds an L-shaped compartment with no wall inside it', () => {
    const generateBin = getGenerateBin();
    const lShape = generateBin(grid(2, 2, [0, 0, 0, 1]), undefined, true);
    const allPockets = generateBin(grid(2, 2, [0, 1, 2, 3]), undefined, true);
    const onePocket = generateBin(grid(2, 2, [0, 0, 0, 0]), undefined, true);

    assertStructurallyValid(lShape, 'L-shaped compartment');
    const topology = meshTopologyStats(lShape);
    expect(topology.boundaryEdges).toBe(0);
    expect(topology.nonManifoldEdges).toBe(0);

    // Two of the three interior walls are gone, so the L sits between the fully
    // divided grid and the undivided one.
    expect(meshVolume(lShape)).toBeLessThan(meshVolume(allPockets));
    expect(meshVolume(lShape)).toBeGreaterThan(meshVolume(onePocket));
  });

  it('builds a U-shaped region wrapping a compartment', () => {
    const generateBin = getGenerateBin();
    // The leftover around a drawn centre cell, as `mergeBackground` produces it.
    const wrapped = generateBin(grid(3, 3, [0, 0, 0, 0, 1, 0, 0, 0, 0]), undefined, true);
    const allPockets = generateBin(
      grid(
        3,
        3,
        Array.from({ length: 9 }, (_, i) => i)
      ),
      undefined,
      true
    );

    assertStructurallyValid(wrapped, 'ring-shaped leftover');
    const topology = meshTopologyStats(wrapped);
    expect(topology.boundaryEdges).toBe(0);
    expect(topology.nonManifoldEdges).toBe(0);
    expect(meshVolume(wrapped)).toBeLessThan(meshVolume(allPockets));
  });
});
