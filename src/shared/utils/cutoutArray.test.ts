import { describe, it, expect } from 'vitest';
import {
  arrayInstances,
  arrayInstanceCount,
  defaultArrayConfig,
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
