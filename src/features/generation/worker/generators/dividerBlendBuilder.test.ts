import { describe, it, expect } from 'vitest';
import {
  resolveOuterCutouts,
  collectDividers,
  buildDividerBlends,
  computeRampZones,
} from './dividerBlendBuilder';
import type { BinParams } from '@/shared/types/bin';
import { DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';

const BASE_PARAMS: BinParams = {
  width: 2,
  depth: 2,
  height: 3,
  gridUnitMm: 42,
  heightUnitMm: 7,
  wallThickness: 1.2,
  style: 'standard',
  slotConfig: {
    x: { enabled: false, pitch: 20 },
    y: { enabled: false, pitch: 20 },
  },
  base: { magnetHoles: false, screwHoles: false },
  lip: true,
  label: { enabled: false, width: 12, angle: 45, overhangAngle: 60 },
  compartments: {
    enabled: true,
    rows: 1,
    cols: 2,
    thickness: 1.2,
    cells: [0, 1],
  },
  inserts: [],
  wallPattern: { enabled: false, pattern: 'honeycomb' as const },
  walls: {
    enabled: true,
    shape: 'u-shape' as const,
    width: 0,
    depth: 0,
    front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
    back: DISABLED_WALL_CUTOUT,
    left: DISABLED_WALL_CUTOUT,
    right: DISABLED_WALL_CUTOUT,
    interior: DISABLED_WALL_CUTOUT,
  },
  exportFileName: { template: 'gridfinity_{w}x{d}x{h}', separator: '_' },
} as BinParams;

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...BASE_PARAMS, ...overrides };
}

// 2×2 bin inner dimensions: (2*42 - 2*1.2) = 81.6mm per axis
const INNER_W = 2 * 42 - 2 * 1.2;
const INNER_D = 2 * 42 - 2 * 1.2;
const WALL_HEIGHT = 3 * 7; // 21mm

describe('resolveOuterCutouts', () => {
  it('returns empty when walls disabled', () => {
    const params = makeParams({ walls: { ...BASE_PARAMS.walls, enabled: false } });
    expect(resolveOuterCutouts(params, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('returns cutout info for enabled sides', () => {
    const cutouts = resolveOuterCutouts(BASE_PARAMS, INNER_W, INNER_D, WALL_HEIGHT);
    expect(cutouts).toHaveLength(1);
    expect(cutouts[0].side).toBe('front');
    expect(cutouts[0].cutWidth).toBeGreaterThan(0);
    expect(cutouts[0].userCutHeight).toBeGreaterThan(0);
    expect(cutouts[0].cutBottom).toBeLessThan(WALL_HEIGHT);
  });

  it('computes correct cut dimensions for percentage-based width', () => {
    const cutouts = resolveOuterCutouts(BASE_PARAMS, INNER_W, INNER_D, WALL_HEIGHT);
    const interiorH = WALL_HEIGHT - BASE_PARAMS.wallThickness;
    expect(cutouts[0].cutWidth).toBeCloseTo(INNER_W * 0.7, 1);
    expect(cutouts[0].userCutHeight).toBeCloseTo(interiorH * 0.5, 1);
  });

  it('returns cutouts for multiple sides', () => {
    const params = makeParams({
      walls: {
        ...BASE_PARAMS.walls,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 30 },
      },
    });
    const cutouts = resolveOuterCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    expect(cutouts).toHaveLength(2);
    expect(cutouts.map((c) => c.side)).toEqual(['front', 'back']);
  });

  it('skips sides with zero width or depth', () => {
    const params = makeParams({
      walls: {
        ...BASE_PARAMS.walls,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 0, depth: 50 },
      },
    });
    const cutouts = resolveOuterCutouts(params, INNER_W, INNER_D, WALL_HEIGHT);
    expect(cutouts).toHaveLength(0);
  });
});

describe('collectDividers', () => {
  it('returns empty for single-compartment bins', () => {
    const params = makeParams({
      compartments: { enabled: true, rows: 1, cols: 1, thickness: 1.2, cells: [0] },
    });
    expect(collectDividers(params, INNER_W, INNER_D)).toEqual([]);
  });

  it('returns empty when all cells share one ID', () => {
    const params = makeParams({
      compartments: { enabled: true, rows: 1, cols: 2, thickness: 1.2, cells: [0, 0] },
    });
    expect(collectDividers(params, INNER_W, INNER_D)).toEqual([]);
  });

  it('returns one vertical divider for 2×1 grid with different IDs', () => {
    const dividers = collectDividers(BASE_PARAMS, INNER_W, INNER_D);
    expect(dividers).toHaveLength(1);
    expect(dividers[0].axis).toBe('vertical');
    expect(dividers[0].posAlongPerp).toBeCloseTo(0, 1); // centered
    expect(dividers[0].spanStart).toBeCloseTo(-INNER_D / 2, 1);
    expect(dividers[0].spanEnd).toBeCloseTo(INNER_D / 2, 1);
  });

  it('returns vertical and horizontal dividers for 2×2 grid', () => {
    const params = makeParams({
      compartments: { enabled: true, rows: 2, cols: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    });
    const dividers = collectDividers(params, INNER_W, INNER_D);
    const verticals = dividers.filter((d) => d.axis === 'vertical');
    const horizontals = dividers.filter((d) => d.axis === 'horizontal');
    expect(verticals).toHaveLength(1);
    expect(horizontals).toHaveLength(1);
  });

  it('omits walls between merged cells', () => {
    const params = makeParams({
      compartments: { enabled: true, rows: 1, cols: 3, thickness: 1.2, cells: [0, 0, 1] },
    });
    const dividers = collectDividers(params, INNER_W, INNER_D);
    // Only one divider between cell 1 (id=0) and cell 2 (id=1)
    expect(dividers).toHaveLength(1);
    expect(dividers[0].axis).toBe('vertical');
  });
});

describe('buildDividerBlends', () => {
  it('returns null for slotted bins', () => {
    const params = makeParams({ style: 'slotted' });
    expect(buildDividerBlends(params, INNER_W, INNER_D, WALL_HEIGHT, true)).toBeNull();
  });

  it('returns null when walls disabled', () => {
    const params = makeParams({ walls: { ...BASE_PARAMS.walls, enabled: false } });
    expect(buildDividerBlends(params, INNER_W, INNER_D, WALL_HEIGHT, true)).toBeNull();
  });

  it('returns null for single-compartment bins', () => {
    const params = makeParams({
      compartments: { enabled: true, rows: 1, cols: 1, thickness: 1.2, cells: [0] },
    });
    expect(buildDividerBlends(params, INNER_W, INNER_D, WALL_HEIGHT, true)).toBeNull();
  });

  it('returns null when no cutouts are enabled', () => {
    const params = makeParams({
      walls: {
        ...BASE_PARAMS.walls,
        front: DISABLED_WALL_CUTOUT,
      },
    });
    expect(buildDividerBlends(params, INNER_W, INNER_D, WALL_HEIGHT, true)).toBeNull();
  });
});

describe('computeRampZones', () => {
  it('returns empty when walls disabled', () => {
    const params = makeParams({ walls: { ...BASE_PARAMS.walls, enabled: false } });
    expect(computeRampZones('front', params, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('returns empty for slotted bins', () => {
    const params = makeParams({ style: 'slotted' });
    expect(computeRampZones('front', params, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('returns empty when no dividers exist', () => {
    const params = makeParams({
      compartments: { enabled: true, rows: 1, cols: 1, thickness: 1.2, cells: [0] },
    });
    expect(computeRampZones('front', params, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('returns empty for walls without cutouts', () => {
    expect(computeRampZones('back', BASE_PARAMS, INNER_W, INNER_D, WALL_HEIGHT)).toEqual([]);
  });

  it('returns ramp zones for adjacent dividers', () => {
    // 3×1 grid: dividers at ±INNER_W/3 (~±13.6mm).
    // Narrow cutout (15% width = 12.24mm): edges at ±6.12mm.
    // Distance from cutout edge to divider1: 13.6 - 6.12 = 7.48mm.
    // userCutHeight at 80% depth: (21-1.2)*0.8 = 15.84mm > 7.48mm → adjacent!
    const params = makeParams({
      compartments: { enabled: true, rows: 1, cols: 3, thickness: 1.2, cells: [0, 1, 2] },
      walls: {
        ...BASE_PARAMS.walls,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 15, depth: 80 },
      },
    });
    const zones = computeRampZones('front', params, INNER_W, INNER_D, WALL_HEIGHT);
    expect(zones.length).toBeGreaterThan(0);
    for (const zone of zones) {
      expect(zone).toEqual(
        expect.objectContaining({
          offsetAlongWall: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        })
      );
    }
  });
});
