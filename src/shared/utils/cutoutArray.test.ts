import { describe, it, expect } from 'vitest';
import {
  arrayInstances,
  arrayInstanceCount,
  defaultArrayConfig,
  arrayFieldBounds,
  expandCutoutArray,
  type ArrayInstance,
} from './cutoutArray';
import type { Cutout, CutoutArrayConfig } from '@/features/bin-designer/types';

function cfg(overrides: Partial<CutoutArrayConfig> = {}): CutoutArrayConfig {
  return {
    mode: 'grid',
    cols: 3,
    rows: 2,
    pitchX: 10,
    pitchY: 8,
    count: 6,
    radius: 20,
    startAngle: 0,
    rotateToCenter: true,
    ...overrides,
  };
}

const master = (insts: ArrayInstance[]) => insts.find((i) => i.isMaster);

describe('grid mode', () => {
  it('places cols × rows instances with the master at the origin', () => {
    const insts = arrayInstances(cfg({ mode: 'grid', cols: 3, rows: 2 }));
    expect(insts).toHaveLength(6);
    const m = master(insts);
    expect(m).toEqual({ dx: 0, dy: 0, drot: 0, isMaster: true });
  });

  it('spaces instances by center-to-center pitch', () => {
    const insts = arrayInstances(cfg({ mode: 'grid', cols: 2, rows: 2, pitchX: 10, pitchY: 8 }));
    const offsets = insts.map((i) => [i.dx, i.dy]);
    expect(offsets).toContainEqual([10, 0]);
    expect(offsets).toContainEqual([0, 8]);
    expect(offsets).toContainEqual([10, 8]);
  });
});

describe('staggered mode', () => {
  it('offsets odd rows by half the X pitch', () => {
    const insts = arrayInstances(
      cfg({ mode: 'staggered', cols: 2, rows: 2, pitchX: 10, pitchY: 8 })
    );
    // Row 0: x = 0, 10. Row 1: x = 5, 15.
    const row1 = insts.filter((i) => i.dy === 8).map((i) => i.dx);
    expect(row1).toEqual([5, 15]);
  });
});

describe('radial mode', () => {
  it('places `count` instances with the master at index 0', () => {
    const insts = arrayInstances(cfg({ mode: 'radial', count: 4, radius: 20, startAngle: 0 }));
    expect(insts).toHaveLength(4);
    expect(master(insts)).toEqual({ dx: 0, dy: 0, drot: 0, isMaster: true });
  });

  it('rotates instances to face center when enabled', () => {
    const insts = arrayInstances(cfg({ mode: 'radial', count: 4, rotateToCenter: true }));
    expect(insts.map((i) => i.drot)).toEqual([0, 90, 180, 270]);
  });

  it('keeps a fixed orientation when rotate-to-center is off', () => {
    const insts = arrayInstances(cfg({ mode: 'radial', count: 4, rotateToCenter: false }));
    expect(insts.every((i) => i.drot === 0)).toBe(true);
  });

  it('forms a closed ring (last instance returns near the master)', () => {
    const insts = arrayInstances(cfg({ mode: 'radial', count: 6, radius: 20, startAngle: 0 }));
    // All instance centers lie on a circle of radius 20 about the ring center.
    const center = { x: insts[0].dx - 20, y: insts[0].dy };
    for (const i of insts) {
      const r = Math.hypot(i.dx - center.x, i.dy - center.y);
      expect(r).toBeCloseTo(20, 4);
    }
  });
});

describe('arrayInstanceCount', () => {
  it('matches the produced instance count', () => {
    const c = cfg({ mode: 'grid', cols: 4, rows: 3 });
    expect(arrayInstanceCount(c)).toBe(arrayInstances(c).length);
  });

  it('caps runaway counts', () => {
    expect(arrayInstanceCount(cfg({ mode: 'grid', cols: 50, rows: 50 }))).toBe(400);
    expect(arrayInstances(cfg({ mode: 'grid', cols: 50, rows: 50 }))).toHaveLength(400);
  });
});

describe('expandCutoutArray', () => {
  const master = (over: Partial<Cutout> = {}): Cutout => ({
    id: 'm',
    shape: 'circle',
    x: 10,
    y: 10,
    width: 8,
    depth: 8,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...over,
  });

  it('returns the cutout unchanged when there is no array', () => {
    const c = master();
    expect(expandCutoutArray(c)).toEqual([c]);
  });

  it('expands a grid into positioned clones with the array stripped', () => {
    const c = master({ array: cfg({ mode: 'grid', cols: 2, rows: 1, pitchX: 10, pitchY: 10 }) });
    const out = expandCutoutArray(c);
    expect(out).toHaveLength(2);
    expect(out.every((o) => o.array === undefined)).toBe(true);
    // Master keeps its x; second instance shifts by pitchX.
    expect(out[0].x).toBe(10);
    expect(out[1].x).toBe(20);
  });

  it('applies per-instance rotation for a rotate-to-center radial', () => {
    const c = master({
      rotation: 0,
      array: cfg({ mode: 'radial', count: 4, radius: 20, rotateToCenter: true }),
    });
    const out = expandCutoutArray(c);
    expect(out.map((o) => o.rotation)).toEqual([0, 90, 180, 270]);
  });
});

describe('defaultArrayConfig', () => {
  it('leaves a gap so default instances do not overlap', () => {
    const c = defaultArrayConfig(15, 10);
    expect(c.pitchX).toBeGreaterThan(15);
    expect(c.pitchY).toBeGreaterThan(10);
    expect(c.mode).toBe('grid');
  });
});

describe('arrayFieldBounds', () => {
  const cut = (overrides: Partial<Cutout> = {}): Cutout => ({
    id: 'm',
    shape: 'circle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  });

  it('caps columns to what fits the bin at the current pitch', () => {
    // 10mm master at x=0 in a 60mm bin, 12mm pitch: 1 + floor((60-10)/12) = 5.
    const b = arrayFieldBounds(cut(), 60, 300, cfg({ pitchX: 12, cols: 3 }));
    expect(b.maxCols).toBe(5);
  });

  it('caps pitch to what keeps the current columns inside the bin', () => {
    // 4 cols, 10mm master at x=0 in 100mm bin: span over 3 gaps ⇒ (100-10)/3 = 30mm.
    const b = arrayFieldBounds(cut(), 100, 300, cfg({ cols: 4, pitchX: 12 }));
    expect(b.maxPitchX).toBe(30);
  });

  it('caps radius to the master box edge clearance, respecting position', () => {
    // 10mm master centered in 120×80: edge clearance = min(55, 35, 55, 35) = 35.
    const centered = arrayFieldBounds(cut({ x: 55, y: 35 }), 120, 80, cfg({ mode: 'radial' }));
    expect(centered.maxRadius).toBe(35);
    // Same master pushed toward an edge has less room, so a smaller radius.
    const offCenter = arrayFieldBounds(cut({ x: 10, y: 35 }), 120, 80, cfg({ mode: 'radial' }));
    expect(offCenter.maxRadius).toBe(10);
  });

  it('does not apply the stagger offset when there is only one row', () => {
    // rows=1 ⇒ no odd row to shift, so staggered cols/pitch match a plain grid.
    const staggered = arrayFieldBounds(
      cut(),
      60,
      300,
      cfg({ mode: 'staggered', rows: 1, cols: 3, pitchX: 12 })
    );
    const grid = arrayFieldBounds(
      cut(),
      60,
      300,
      cfg({ mode: 'grid', rows: 1, cols: 3, pitchX: 12 })
    );
    expect(staggered.maxCols).toBe(grid.maxCols);
    expect(staggered.maxPitchX).toBe(grid.maxPitchX);
  });

  it('never drops a field below its minimum even when the master fills the bin', () => {
    const b = arrayFieldBounds(cut({ x: 0, width: 50 }), 50, 50, cfg({ pitchX: 12 }));
    expect(b.maxCols).toBe(1);
    expect(b.maxPitchX).toBeGreaterThanOrEqual(1);
    expect(b.maxRadius).toBeGreaterThanOrEqual(1);
  });

  it('honors the global instance cap given the other axis count', () => {
    // 80 rows × maxCols ≤ 400 ⇒ maxCols ≤ 5, even though spatially more would fit.
    const b = arrayFieldBounds(cut({ width: 1 }), 10_000, 10_000, cfg({ rows: 80, pitchX: 2 }));
    expect(b.maxCols).toBeLessThanOrEqual(5);
  });
});
