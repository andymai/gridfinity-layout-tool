import { describe, expect, it } from 'vitest';
import {
  compartmentCavity,
  singleCellCavity,
  solveCountForTargetCavity,
} from './compartmentDimensions';
import { createUniformGrid, mergeCells } from './compartments';
import type { CompartmentConfig } from '../types';

describe('singleCellCavity', () => {
  it('returns the full interior for a single cell', () => {
    expect(singleCellCavity(100, 1, 1.2)).toBe(100);
  });

  it('subtracts internal divider walls before splitting (average cavity)', () => {
    // 4 cells, 3 walls of 1.2mm: (100 - 3.6) / 4 = 24.1
    expect(singleCellCavity(100, 4, 1.2)).toBeCloseTo(24.1, 6);
  });

  it('treats non-positive counts as the full span', () => {
    expect(singleCellCavity(100, 0, 1.2)).toBe(100);
  });
});

describe('solveCountForTargetCavity', () => {
  it('picks the count whose cavity is closest to the target', () => {
    // interior 154, t=1.2: 3 -> 50.5, 4 -> 37.6. target 40 -> 4
    expect(solveCountForTargetCavity(154, 1.2, 40, 1, 12)).toBe(4);
  });

  it('resolves exact divisions', () => {
    // interior 100, t=0: target 25 -> exactly 4
    expect(solveCountForTargetCavity(100, 0, 25, 1, 12)).toBe(4);
  });

  it('clamps to the minimum count for very large targets', () => {
    expect(solveCountForTargetCavity(154, 1.2, 500, 1, 12)).toBe(1);
  });

  it('breaks ties toward the smaller (larger-compartment) count', () => {
    // interior 12, t=0: 2 -> 6, 3 -> 4; target 5 is equidistant -> smaller (2)
    expect(solveCountForTargetCavity(12, 0, 5, 1, 12)).toBe(2);
  });

  it('never returns a count whose cavity collapses to zero', () => {
    // interior 3, walls 3mm: count 2 collapses the cavity to 0 (skipped), so
    // only count 1 (cavity 3) survives even though the target is tiny.
    expect(solveCountForTargetCavity(3, 3, 1, 1, 12)).toBe(1);
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
