import { describe, it, expect } from 'vitest';
import {
  anyCompartmentColored,
  enumerateCompartmentColorUnits,
  planCompartmentColors,
  resolveCompartmentTriColor,
} from './compartmentColorUnits';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';

const LEFT = '#ff0000';
const RIGHT = '#0000ff';

/** 2x1 grid across a 2x1 bin: compartment 0 at -X, compartment 1 at +X. */
function twoUp(overrides: Partial<BinParams['compartments']> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 1,
    height: 5,
    compartments: {
      cols: 2,
      rows: 1,
      thickness: 1.2,
      cells: [0, 1],
      compartmentColors: [LEFT, RIGHT],
      ...overrides,
    },
  };
}

function planOf(params: BinParams) {
  const plan = planCompartmentColors(params);
  if (!plan) throw new Error('expected a plan');
  return plan;
}

describe('anyCompartmentColored', () => {
  it('is false for an absent or all-null array', () => {
    expect(anyCompartmentColored(twoUp({ compartmentColors: undefined }))).toBe(false);
    expect(anyCompartmentColored(twoUp({ compartmentColors: [null, null] }))).toBe(false);
  });

  it('is true as soon as one compartment carries a colour', () => {
    expect(anyCompartmentColored(twoUp({ compartmentColors: [null, RIGHT] }))).toBe(true);
  });
});

describe('enumerateCompartmentColorUnits', () => {
  it('yields one unit per distinct compartment, defaulting the scope to floor', () => {
    const units = enumerateCompartmentColorUnits(twoUp());
    expect(units).toEqual([
      { id: 0, color: LEFT, colorScope: 'floor' },
      { id: 1, color: RIGHT, colorScope: 'floor' },
    ]);
  });

  it('treats an empty-string colour as uncoloured', () => {
    const units = enumerateCompartmentColorUnits(twoUp({ compartmentColors: ['', RIGHT] }));
    expect(units[0].color).toBeUndefined();
  });
});

describe('planCompartmentColors', () => {
  it('is null when nothing is coloured, so callers skip the per-triangle work', () => {
    expect(planCompartmentColors(twoUp({ compartmentColors: undefined }))).toBeNull();
    expect(planCompartmentColors(twoUp({ compartmentColors: [null, null] }))).toBeNull();
  });

  it('emits one rect per cell of a coloured compartment only', () => {
    const plan = planOf(twoUp({ compartmentColors: [LEFT, null] }));
    expect(plan.cells).toHaveLength(1);
    expect(plan.cells[0].id).toBe(0);
    expect(plan.cells[0].x1).toBeLessThanOrEqual(0.0001);
  });

  it('splits an L-shaped compartment into its own cells, not its bounding box', () => {
    // 2x2 grid; compartment 0 owns three cells in an L, compartment 1 the
    // remaining corner. A bounding-box rect for 0 would swallow that corner.
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 5,
      compartments: {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 0, 0, 1],
        compartmentColors: [LEFT, null],
      },
    };
    const plan = planOf(params);
    expect(plan.cells).toHaveLength(3);
    expect(plan.cells.every((c) => c.id === 0)).toBe(true);
  });
});

describe('resolveCompartmentTriColor', () => {
  const plan = planOf(twoUp({ compartmentColorScopes: ['floorAndWalls', 'floorAndWalls'] }));
  const insideZ = plan.zMin + 1;

  it('claims an up-facing floor triangle for the compartment it sits in', () => {
    const left = { cx: -20, cy: 0, cz: plan.zMin + 0.005, nx: 0, ny: 0, nz: 1 };
    const right = { cx: 20, cy: 0, cz: plan.zMin + 0.005, nx: 0, ny: 0, nz: 1 };
    expect(resolveCompartmentTriColor(plan, left)).toBe(LEFT);
    expect(resolveCompartmentTriColor(plan, right)).toBe(RIGHT);
  });

  /**
   * The case the normal step exists for. A face lying exactly ON the boundary
   * between two coloured compartments — a perimeter wall's inner face, or a wall
   * a `dividerOverride` has pushed onto the grid line — has an ambiguous
   * centroid; only its normal says which side it belongs to. Both assertions
   * fail if the step is dropped or its sign flipped.
   */
  it('lets the normal decide a face sitting exactly on the boundary', () => {
    const boundaryX = plan.cells[0].x1;
    const facingLeft = { cx: boundaryX, cy: 0, cz: insideZ, nx: -1, ny: 0, nz: 0 };
    const facingRight = { cx: boundaryX, cy: 0, cz: insideZ, nx: 1, ny: 0, nz: 0 };

    expect(resolveCompartmentTriColor(plan, facingLeft)).toBe(LEFT);
    expect(resolveCompartmentTriColor(plan, facingRight)).toBe(RIGHT);
  });

  it('refuses a wall face when the compartment paints floor only', () => {
    const floorOnly = planOf(twoUp());
    const wall = { cx: -20, cy: 0, cz: floorOnly.zMin + 1, nx: -1, ny: 0, nz: 0 };
    const floor = { cx: -20, cy: 0, cz: floorOnly.zMin + 0.005, nx: 0, ny: 0, nz: 1 };

    expect(resolveCompartmentTriColor(floorOnly, wall)).toBeNull();
    expect(resolveCompartmentTriColor(floorOnly, floor)).toBe(LEFT);
  });

  it('refuses anything outside the cavity Z band', () => {
    const under = { cx: -20, cy: 0, cz: plan.zMin - 1, nx: 0, ny: 0, nz: -1 };
    const over = { cx: -20, cy: 0, cz: plan.zMax + 1, nx: 0, ny: 0, nz: 1 };

    expect(resolveCompartmentTriColor(plan, under)).toBeNull();
    expect(resolveCompartmentTriColor(plan, over)).toBeNull();
  });

  it('refuses a face outside every coloured compartment', () => {
    const outside = { cx: 500, cy: 500, cz: insideZ, nx: 0, ny: 0, nz: 1 };
    expect(resolveCompartmentTriColor(plan, outside)).toBeNull();
  });
});
