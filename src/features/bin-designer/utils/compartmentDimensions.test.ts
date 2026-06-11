import { describe, expect, it } from 'vitest';
import {
  compartmentCavity,
  minUniformCavity,
  solveCountForMinCavity,
} from './compartmentDimensions';
import { createUniformGrid, mergeCells } from './compartments';
import type { CompartmentConfig } from '../types';

describe('minUniformCavity', () => {
  it('returns the full interior for a single cell', () => {
    expect(minUniformCavity(100, 1, 1.2)).toBe(100);
  });

  it('subtracts a half wall per cell for a two-way split (both edges)', () => {
    // 2 cells: pitch 50, each loses half the single divider -> 50 - 0.6 = 49.4
    expect(minUniformCavity(100, 2, 1.2)).toBeCloseTo(49.4, 6);
  });

  it('uses the interior cell (full wall) as the minimum for 3+ cells', () => {
    // 4 cells: pitch 25, interior cell loses a full wall -> 25 - 1.2 = 23.8
    expect(minUniformCavity(100, 4, 1.2)).toBeCloseTo(23.8, 6);
  });
});

describe('solveCountForMinCavity', () => {
  it('packs as many compartments as fit while keeping each >= target', () => {
    // interior 100, t=1.2: min cavity by count -> 1:100, 2:49.4, 3:32.1, 4:23.8.
    // target 30 -> largest count with min >= 30 is 3 (32.1), since 4 (23.8) < 30.
    expect(solveCountForMinCavity(100, 1.2, 30, 1, 12)).toBe(3);
  });

  it('rounds DOWN the count rather than ever going below target', () => {
    // interior 81, t=1.2: 2 -> 39.9 (< 40). So target 40 -> only count 1 fits.
    expect(solveCountForMinCavity(81, 1.2, 40, 1, 12)).toBe(1);
  });

  it('falls back to the minimum count when the target exceeds the interior', () => {
    expect(solveCountForMinCavity(100, 1.2, 500, 1, 12)).toBe(1);
  });

  it('respects the maximum count for tiny targets', () => {
    // target 1mm fits far more than 12; clamp to maxCount.
    expect(solveCountForMinCavity(100, 0, 1, 1, 12)).toBe(12);
  });
});

describe('compartmentCavity', () => {
  it('reports the full interior for a 1×1 grid', () => {
    const config = createUniformGrid(1, 1, 1.2);
    const cavity = compartmentCavity(config, 0, 100, 80);
    expect(cavity).toEqual({
      id: 0,
      width: 100,
      depth: 80,
      xMin: -50,
      xMax: 50,
      yMin: -40,
      yMax: 40,
      minCol: 0,
      maxCol: 0,
      minRow: 0,
      maxRow: 0,
    });
  });

  it('insets half a wall only on interior edges (generator model)', () => {
    // 4 cols, innerW 100, t 1.2 -> cellW 25, half 0.6.
    // Edge cell 0: inset only on its right (interior) side -> width 25 - 0.6 = 24.4.
    const config = createUniformGrid(4, 1, 1.2);
    const edge = compartmentCavity(config, 0, 100, 80);
    expect(edge?.width).toBeCloseTo(24.4, 6);
    // Interior cell 1: inset on both sides -> 25 - 1.2 = 23.8.
    const interior = compartmentCavity(config, 1, 100, 80);
    expect(interior?.width).toBeCloseTo(23.8, 6);
  });

  it('returns null for an absent compartment id', () => {
    const config = createUniformGrid(2, 2, 1.2);
    expect(compartmentCavity(config, 99, 100, 80)).toBeNull();
  });

  it('grows when cells are merged across columns', () => {
    const config = createUniformGrid(4, 1, 1.2);
    // merge the first two columns -> spans cols 0..1 (edge on the left).
    const merged = mergeCells(config, [0, 1]) as CompartmentConfig;
    const cavity = compartmentCavity(merged, 0, 154, 80);
    // cellW 38.5; spans 2 cells from the left wall, inset half (0.6) on the
    // right interior edge only: 2*38.5 - 0.6 = 76.4.
    expect(cavity?.width).toBeCloseTo(76.4, 6);
    expect(cavity?.depth).toBeCloseTo(80, 6);
  });
});
