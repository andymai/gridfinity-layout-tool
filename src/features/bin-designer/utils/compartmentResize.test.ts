import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams, CompartmentConfig } from '@/features/bin-designer/types';
import { getEligibleDividers } from './compartments';
import { compartmentCavityExact } from './compartmentDimensions';
import { getDividerGeometry, getInteriorDims } from './dividerAngle';
import {
  planCompartmentResize,
  resizedDividerOverrides,
  type ResizeAxis,
  type ResizeWall,
} from './compartmentResize';

// A 2×5 bin, the shape from the original request.
const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 5 };
const { innerW, innerD } = getInteriorDims(params);

function grid(cols: number, rows: number, cells: number[]): CompartmentConfig {
  return { cols, rows, thickness: 1.2, cells };
}

function wallsOf(config: CompartmentConfig): ResizeWall[] {
  const envelope = { ...params, compartments: config, dividerHeightMm: 30 };
  return getEligibleDividers(config).map((d) => ({
    ...d,
    geometry: getDividerGeometry(envelope, config, d),
  }));
}

function plan(config: CompartmentConfig, id: number, axis: ResizeAxis, walls = wallsOf(config)) {
  return planCompartmentResize(config, id, axis, innerW, innerD, walls);
}

function resize(config: CompartmentConfig, id: number, axis: ResizeAxis, mm: number) {
  const p = plan(config, id, axis);
  if (!p) throw new Error('expected a resize plan');
  return { ...config, dividerOverrides: resizedDividerOverrides(config, p, mm) };
}

function widthOf(config: CompartmentConfig, id: number): number {
  return compartmentCavityExact(config, id, innerW, innerD)?.width ?? Number.NaN;
}

// Three compartments side by side, two grid cells each.
const row = grid(6, 1, [0, 0, 1, 1, 2, 2]);

describe('planCompartmentResize', () => {
  it('sizes two compartments to 23 mm and leaves the rest to the third', () => {
    const first = resize(row, 0, 'width', 23);
    const second = resize(first, 1, 'width', 23);

    expect(widthOf(second, 0)).toBeCloseTo(23, 2);
    expect(widthOf(second, 1)).toBeCloseTo(23, 2);
    const walls = 2 * row.thickness;
    expect(widthOf(second, 2)).toBeCloseTo(innerW - 46 - walls, 2);
  });

  it('moves the far wall first, so a sized neighbour on the near side keeps its size', () => {
    const first = resize(row, 0, 'width', 23);
    expect(plan(first, 1, 'width')?.direction).toBe(1);
    expect(widthOf(resize(first, 1, 'width', 30), 0)).toBeCloseTo(23, 2);
  });

  it('moves the near wall when the far side is the bin wall', () => {
    const p = plan(row, 2, 'width');
    expect(p?.direction).toBe(-1);
    expect(widthOf(resize(row, 2, 'width', 20), 2)).toBeCloseTo(20, 2);
  });

  it('cannot change a size that the bin walls set on both sides', () => {
    expect(plan(row, 0, 'depth')).toBeNull();
  });

  it('skips a side whose neighbour is not in the movable walls', () => {
    const onlyFirstWall = wallsOf(row).filter((w) => w.compartmentB === 1);
    expect(plan(row, 2, 'width', onlyFirstWall)).toBeNull();
    expect(plan(row, 1, 'width', onlyFirstWall)?.direction).toBe(-1);
  });

  it('clamps to the range the neighbour can give up', () => {
    const p = plan(row, 0, 'width');
    if (!p) throw new Error('expected a resize plan');
    const resized = { ...row, dividerOverrides: resizedDividerOverrides(row, p, 1000) };
    expect(widthOf(resized, 0)).toBeCloseTo(p.maxMm, 2);
    expect(p.minMm).toBeGreaterThan(0);
  });

  it('moves every wall on a shared side together, so the edge stays straight', () => {
    // A tall compartment on the left with two stacked neighbours on the right.
    const config = grid(2, 2, [0, 1, 0, 2]);
    const resized = resize(config, 0, 'width', 30);
    const offsets = (resized.dividerOverrides ?? []).map((o) => [o.offsetStart, o.offsetEnd]);
    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toEqual(offsets[1]);
    expect(widthOf(resized, 0)).toBeCloseTo(30, 2);
  });

  it('keeps an existing angle on the moved wall', () => {
    const tilted: CompartmentConfig = {
      ...row,
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: -2, offsetEnd: 2 }],
    };
    const resized = resize(tilted, 0, 'width', widthOf(tilted, 0) + 3);
    const wall = resized.dividerOverrides?.[0];
    expect(wall ? wall.offsetEnd - wall.offsetStart : Number.NaN).toBeCloseTo(4, 2);
  });

  it('sets a depth by moving the back wall', () => {
    const column = grid(1, 3, [0, 1, 2]);
    const resized = resize(column, 0, 'depth', 50);
    expect(compartmentCavityExact(resized, 0, innerW, innerD)?.depth).toBeCloseTo(50, 2);
  });
});
