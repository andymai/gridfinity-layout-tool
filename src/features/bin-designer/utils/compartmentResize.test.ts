import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams, CompartmentConfig } from '@/features/bin-designer/types';
import { DIVIDER_OFFSET_MAX_MM, getEligibleDividers } from './compartments';
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

  it('refuses a side that meets another wall at a T-junction', () => {
    // A tall compartment on the left with two stacked neighbours on the right:
    // the wall between those two keeps its grid endpoint, so a moved side
    // would open a gap between them.
    expect(plan(grid(2, 2, [0, 1, 0, 2]), 0, 'width')).toBeNull();
    // A neighbour taller than the compartment: the compartment's own top wall
    // keeps its grid endpoint.
    expect(plan(grid(2, 2, [0, 1, 2, 1]), 0, 'width')).toBeNull();
    expect(plan(grid(2, 2, [0, 1, 2, 1]), 1, 'width')).toBeNull();
  });

  it('keeps every pocket at the minimum size after earlier edits moved its walls', () => {
    const first = resize(row, 0, 'width', 40);
    const p = plan(first, 1, 'width');
    if (!p) throw new Error('expected a resize plan');
    expect(p.minMm).toBeGreaterThanOrEqual(DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE);
    expect(p.maxMm).toBeLessThanOrEqual(
      widthOf(first, 1) + widthOf(first, 2) - DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE + 1e-6
    );

    const squeezed = { ...first, dividerOverrides: resizedDividerOverrides(first, p, 0) };
    expect(widthOf(squeezed, 1)).toBeGreaterThanOrEqual(
      DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE - 1e-6
    );
    const widened = { ...first, dividerOverrides: resizedDividerOverrides(first, p, 1000) };
    expect(widthOf(widened, 2)).toBeGreaterThanOrEqual(
      DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE - 1e-6
    );
  });

  it('refuses the second edit at a four-way junction once the first moved a wall there', () => {
    const quad = grid(2, 2, [0, 1, 2, 3]);
    const widened = resize(quad, 0, 'width', 23);
    expect(widthOf(widened, 0)).toBeCloseTo(23, 2);
    expect(plan(widened, 0, 'depth')).toBeNull();
    expect(plan(widened, 2, 'width')).toBeNull();
  });

  it('refuses a side whose compartment or neighbour has a leaning wall', () => {
    const leaning: CompartmentConfig = {
      ...row,
      dividerOverrides: [
        { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg: 30 },
      ],
    };
    expect(plan(leaning, 1, 'width')).toBeNull();
    expect(plan(leaning, 0, 'width')).toBeNull();
    expect(plan(leaning, 2, 'width')).toBeNull();
  });

  it('keeps the wall offsets inside the limit that share validation enforces', () => {
    const wide: BinParams = { ...DEFAULT_BIN_PARAMS, width: 16, depth: 1 };
    const dims = getInteriorDims(wide);
    const pair = grid(2, 1, [0, 1]);
    const walls = getEligibleDividers(pair).map((d) => ({
      ...d,
      geometry: getDividerGeometry({ ...wide, compartments: pair, dividerHeightMm: 30 }, pair, d),
    }));
    const p = planCompartmentResize(pair, 0, 'width', dims.innerW, dims.innerD, walls);
    if (!p) throw new Error('expected a resize plan');
    for (const target of [0, 23, 10_000]) {
      for (const o of resizedDividerOverrides(pair, p, target)) {
        expect(Math.abs(o.offsetStart)).toBeLessThanOrEqual(DIVIDER_OFFSET_MAX_MM);
        expect(Math.abs(o.offsetEnd)).toBeLessThanOrEqual(DIVIDER_OFFSET_MAX_MM);
      }
    }
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
