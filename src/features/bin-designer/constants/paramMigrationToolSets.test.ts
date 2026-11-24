import { describe, expect, it } from 'vitest';
import { migrateCutoutToolSets } from './paramMigrationToolSets';

const spec = {
  family: 'combinationWrench',
  units: 'sae',
  sizes: ['1/2', '9/16'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

describe('migrateCutoutToolSets', () => {
  it('keeps the spec of a container the design still has', () => {
    expect(migrateCutoutToolSets({ a: spec }, new Set(['a']))).toEqual({ a: spec });
  });

  it('drops specs whose container is gone, and an empty map', () => {
    expect(migrateCutoutToolSets({ a: spec }, new Set(['b']))).toBeUndefined();
    expect(migrateCutoutToolSets(undefined, new Set(['a']))).toBeUndefined();
  });

  it('clamps numbers into range and drops a spec it cannot read', () => {
    const out = migrateCutoutToolSets(
      { a: { ...spec, clearanceMm: 9, labelSizeMm: -2 }, b: { ...spec, family: 'hammer' } },
      new Set(['a', 'b'])
    );
    expect(out?.a?.clearanceMm).toBe(2);
    expect(out?.a?.labelSizeMm).toBe(0);
    expect(out?.b).toBeUndefined();
  });

  it('drops bad size keys and a spec left with none', () => {
    const out = migrateCutoutToolSets(
      { a: { ...spec, sizes: ['1/2', 7, ''] }, b: { ...spec, sizes: [7] } },
      new Set(['a', 'b'])
    );
    expect(out?.a?.sizes).toEqual(['1/2']);
    expect(out?.b).toBeUndefined();
  });

  it('drops size keys and set ids the server would refuse', () => {
    const long = 'x'.repeat(65);
    const out = migrateCutoutToolSets(
      { a: { ...spec, sizes: ['1/2', '9/16\n'] }, [long]: spec, 'b\u0007': spec },
      new Set(['a', long, 'b\u0007'])
    );
    expect(out).toEqual({ a: { ...spec, sizes: ['1/2'] } });
  });
});
