import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { migrateSlant, normalizeSlant, resolveSlant, slantBlocker } from './slantPlan';

const slanted: BinParams = { ...DEFAULT_BIN_PARAMS, slant: { angleDeg: 45, side: 'back' } };

describe('resolveSlant', () => {
  it('is null for an upright bin', () => {
    expect(resolveSlant(DEFAULT_BIN_PARAMS)).toBeNull();
    expect(
      resolveSlant({ ...DEFAULT_BIN_PARAMS, slant: { angleDeg: 0, side: 'back' } })
    ).toBeNull();
  });

  it.each([
    ['front', 'y', -1],
    ['back', 'y', 1],
    ['left', 'x', -1],
    ['right', 'x', 1],
  ] as const)('leans toward %s along %s with sign %i', (side, axis, sign) => {
    const plan = resolveSlant({ ...DEFAULT_BIN_PARAMS, slant: { angleDeg: 45, side } });
    expect(plan).toMatchObject({ side, axis, sign });
    expect(plan?.k).toBeCloseTo(1, 9);
  });

  it('caps the angle at 60 degrees', () => {
    const plan = resolveSlant({ ...DEFAULT_BIN_PARAMS, slant: { angleDeg: 89, side: 'back' } });
    expect(plan?.angleDeg).toBe(60);
    expect(plan?.k).toBeCloseTo(Math.sqrt(3), 9);
  });

  it('reports the end support', () => {
    expect(resolveSlant(slanted)?.endSupport).toBe(false);
    const withSupport = {
      ...slanted,
      slant: { angleDeg: 30, side: 'back' as const, endSupport: true },
    };
    expect(resolveSlant(withSupport)?.endSupport).toBe(true);
  });

  it('rejects a side that is not one of the four', () => {
    const bad = {
      ...DEFAULT_BIN_PARAMS,
      slant: { angleDeg: 30, side: 'up' },
    } as unknown as BinParams;
    expect(resolveSlant(bad)).toBeNull();
  });
});

describe('slantBlocker', () => {
  it.each<[string, Partial<BinParams>, string]>([
    [
      'an overhang',
      { overhang: { enabled: true, left: 3, right: 0, front: 0, back: 0 } },
      'overhang',
    ],
    [
      'a custom shape',
      { width: 1, depth: 1, cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] } },
      'customShape',
    ],
    ['a tray bottom', { base: { ...DEFAULT_BIN_PARAMS.base, style: 'lid' } }, 'trayBottom'],
    ['slide rails', { slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true } }, 'slide'],
    ['a knife rest', { knifeRest: { enabled: true } }, 'knifeRest'],
    [
      'a floor pattern',
      {
        floorPattern: {
          ...DEFAULT_BIN_PARAMS.floorPattern,
          enabled: true,
        } as BinParams['floorPattern'],
      },
      'floorPattern',
    ],
    ['a spacer', { base: { ...DEFAULT_BIN_PARAMS.base, spacer: true } }, 'openFloor'],
    [
      'an open lightweight floor',
      { base: { ...DEFAULT_BIN_PARAMS.base, lightweight: true, lightweightMode: 'interior' } },
      'openFloor',
    ],
  ])('blocks on %s and drops the slant', (_label, overrides, blocker) => {
    const params = { ...slanted, ...overrides };
    expect(slantBlocker(params)).toBe(blocker);
    expect(resolveSlant(params)).toBeNull();
  });

  it('allows the underside lightweight relief and a flat base', () => {
    const relief = {
      ...slanted,
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        lightweight: true,
        lightweightMode: 'underside' as const,
      },
    };
    expect(slantBlocker(relief)).toBeNull();
    const flat = {
      ...slanted,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' as const, lightweight: true },
    };
    expect(slantBlocker(flat)).toBeNull();
  });
});

describe('normalizeSlant', () => {
  it('turns the stacking lip off on a slanted bin', () => {
    expect(DEFAULT_BIN_PARAMS.base.stackingLip).toBe(true);
    expect(normalizeSlant(slanted).base.stackingLip).toBe(false);
  });

  it('returns upright and blocked bins untouched', () => {
    expect(normalizeSlant(DEFAULT_BIN_PARAMS)).toBe(DEFAULT_BIN_PARAMS);
    const blocked = { ...slanted, slide: { ...DEFAULT_BIN_PARAMS.slide, enabled: true } };
    expect(normalizeSlant(blocked)).toBe(blocked);
  });
});

describe('migrateSlant', () => {
  it('keeps a well-formed slant and drops a false end support', () => {
    expect(migrateSlant({ angleDeg: 30, side: 'left', endSupport: false })).toEqual({
      angleDeg: 30,
      side: 'left',
    });
    expect(migrateSlant({ angleDeg: 30, side: 'left', endSupport: true })).toEqual({
      angleDeg: 30,
      side: 'left',
      endSupport: true,
    });
  });

  it('caps the angle', () => {
    expect(migrateSlant({ angleDeg: 75, side: 'back' })).toEqual({ angleDeg: 60, side: 'back' });
  });

  it.each([
    undefined,
    null,
    'back',
    { angleDeg: 0, side: 'back' },
    { angleDeg: -5, side: 'back' },
    { angleDeg: Number.NaN, side: 'back' },
    { angleDeg: 30, side: 'down' },
  ])('leaves no slant for %j', (raw) => {
    expect(migrateSlant(raw)).toBeUndefined();
  });
});
