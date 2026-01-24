import { describe, it, expect } from 'vitest';
import { StageCache, getInvalidationLevel } from '../worker/stageCache';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, ...overrides };
}

describe('getInvalidationLevel', () => {
  it('returns "base" when prev is null', () => {
    expect(getInvalidationLevel(null, makeParams())).toBe('base');
  });

  it('returns "none" when params are identical', () => {
    const params = makeParams();
    expect(getInvalidationLevel(params, params)).toBe('none');
  });

  it('returns "base" when width changes', () => {
    const prev = makeParams({ width: 2 });
    const next = makeParams({ width: 3 });
    expect(getInvalidationLevel(prev, next)).toBe('base');
  });

  it('returns "base" when depth changes', () => {
    const prev = makeParams({ depth: 2 });
    const next = makeParams({ depth: 4 });
    expect(getInvalidationLevel(prev, next)).toBe('base');
  });

  it('returns "base" when base style changes', () => {
    const prev = makeParams();
    const next = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } });
    expect(getInvalidationLevel(prev, next)).toBe('base');
  });

  it('returns "base" when magnet diameter changes', () => {
    const prev = makeParams();
    const next = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, magnetDiameter: 8 } });
    expect(getInvalidationLevel(prev, next)).toBe('base');
  });

  it('returns "shell" when height changes', () => {
    const prev = makeParams({ height: 3 });
    const next = makeParams({ height: 5 });
    expect(getInvalidationLevel(prev, next)).toBe('shell');
  });

  it('returns "shell" when wallThickness changes', () => {
    const prev = makeParams({ wallThickness: 1.2 });
    const next = makeParams({ wallThickness: 0.8 });
    expect(getInvalidationLevel(prev, next)).toBe('shell');
  });

  it('returns "shell" when style changes', () => {
    const prev = makeParams({ style: 'standard' });
    const next = makeParams({ style: 'solid' });
    expect(getInvalidationLevel(prev, next)).toBe('shell');
  });

  it('returns "assembly" when stackingLip changes', () => {
    const prev = makeParams();
    const next = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } });
    expect(getInvalidationLevel(prev, next)).toBe('assembly');
  });

  it('returns "features" when compartments change', () => {
    const prev = makeParams();
    const next = makeParams({
      compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] },
    });
    expect(getInvalidationLevel(prev, next)).toBe('features');
  });

  it('returns "features" when scoop changes', () => {
    const prev = makeParams();
    const next = makeParams({
      scoop: { enabled: true, radius: 'auto', allRows: false },
    });
    expect(getInvalidationLevel(prev, next)).toBe('features');
  });

  it('returns "features" when inserts change', () => {
    const prev = makeParams();
    const next = makeParams({
      inserts: [
        {
          id: 'i1',
          templateId: null,
          shape: 'circle',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
      ],
    });
    expect(getInvalidationLevel(prev, next)).toBe('features');
  });

  it('detects earliest changed stage when multiple change', () => {
    const prev = makeParams({ width: 2, height: 3 });
    const next = makeParams({ width: 4, height: 5 });
    // Width affects base (earliest), height affects shell
    expect(getInvalidationLevel(prev, next)).toBe('base');
  });
});

describe('StageCache', () => {
  it('starts with null for all cached shapes', () => {
    const cache = new StageCache();
    expect(cache.getBase()).toBeNull();
    expect(cache.getShell()).toBeNull();
    expect(cache.getAssembly()).toBeNull();
  });

  it('stores and retrieves shapes', () => {
    const cache = new StageCache();
    const base = { type: 'base' };
    const shell = { type: 'shell' };
    const assembly = { type: 'assembly' };

    cache.setBase(base);
    cache.setShell(shell);
    cache.setAssembly(assembly);

    expect(cache.getBase()).toBe(base);
    expect(cache.getShell()).toBe(shell);
    expect(cache.getAssembly()).toBe(assembly);
  });

  it('returns "base" invalidation with no previous params', () => {
    const cache = new StageCache();
    expect(cache.getInvalidationLevel(makeParams())).toBe('base');
  });

  it('returns "none" after setParams with same params', () => {
    const cache = new StageCache();
    const params = makeParams();
    cache.setParams(params);
    expect(cache.getInvalidationLevel(params)).toBe('none');
  });

  it('invalidateFrom("base") clears all shapes', () => {
    const cache = new StageCache();
    cache.setBase({});
    cache.setShell({});
    cache.setAssembly({});

    cache.invalidateFrom('base');
    expect(cache.getBase()).toBeNull();
    expect(cache.getShell()).toBeNull();
    expect(cache.getAssembly()).toBeNull();
  });

  it('invalidateFrom("shell") keeps base, clears shell+assembly', () => {
    const cache = new StageCache();
    const base = { type: 'base' };
    cache.setBase(base);
    cache.setShell({});
    cache.setAssembly({});

    cache.invalidateFrom('shell');
    expect(cache.getBase()).toBe(base);
    expect(cache.getShell()).toBeNull();
    expect(cache.getAssembly()).toBeNull();
  });

  it('invalidateFrom("assembly") keeps base+shell, clears assembly', () => {
    const cache = new StageCache();
    const base = { type: 'base' };
    const shell = { type: 'shell' };
    cache.setBase(base);
    cache.setShell(shell);
    cache.setAssembly({});

    cache.invalidateFrom('assembly');
    expect(cache.getBase()).toBe(base);
    expect(cache.getShell()).toBe(shell);
    expect(cache.getAssembly()).toBeNull();
  });

  it('invalidateFrom("features") keeps all shapes', () => {
    const cache = new StageCache();
    const base = { type: 'base' };
    const shell = { type: 'shell' };
    const assembly = { type: 'assembly' };
    cache.setBase(base);
    cache.setShell(shell);
    cache.setAssembly(assembly);

    cache.invalidateFrom('features');
    expect(cache.getBase()).toBe(base);
    expect(cache.getShell()).toBe(shell);
    expect(cache.getAssembly()).toBe(assembly);
  });

  it('clear() removes all cached data', () => {
    const cache = new StageCache();
    cache.setBase({});
    cache.setShell({});
    cache.setAssembly({});
    cache.setParams(makeParams());

    cache.clear();
    expect(cache.getBase()).toBeNull();
    expect(cache.getShell()).toBeNull();
    expect(cache.getAssembly()).toBeNull();
    expect(cache.getInvalidationLevel(makeParams())).toBe('base');
  });
});
