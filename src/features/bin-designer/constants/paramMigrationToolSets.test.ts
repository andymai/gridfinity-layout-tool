import { describe, expect, it } from 'vitest';
import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import { migrateCutoutToolSets, migrateToolSetParts } from './paramMigrationToolSets';

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

describe('migrateToolSetParts', () => {
  const metric: ToolSetSpec = {
    family: 'combinationWrench',
    units: 'metric',
    sizes: ['13', '8', '10'],
    style: 'flat',
    clearanceMm: 0.4,
    labelSizeMm: 5,
    fingerChannel: true,
  };
  const sets = { g1: metric };
  const at = (id: string, shape: Cutout['shape'], extra: Partial<Cutout> = {}): Cutout => ({
    id,
    shape,
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    parentGroups: ['g1'],
    ...extra,
  });

  it('marks the pockets, channel and labels of a set saved without parts', () => {
    const cutouts = [
      at('p8', 'path'),
      at('p10', 'path'),
      at('p13', 'path'),
      at('ch', 'slot', { finger: { bottom: 'curved' } }),
      at('l8', 'text', { label: '8' }),
      at('mine', 'circle'),
    ];
    const out = migrateToolSetParts(cutouts, sets, sets);
    expect(out.map((c) => c.toolSetPart)).toEqual([
      'pocket:8',
      'pocket:10',
      'pocket:13',
      'channel',
      'label:8',
      undefined,
    ]);
    expect(migrateToolSetParts(out, sets, sets)).toBe(out);
  });

  it('gives placeholder parts when the pockets no longer match the recipe', () => {
    const out = migrateToolSetParts([at('a', 'path'), at('b', 'path')], sets, sets);
    expect(out.map((c) => c.toolSetPart)).toEqual(['pocket:#0', 'pocket:#1']);
  });

  it('drops a part the server would refuse', () => {
    const cutouts = [
      at('a', 'path', { toolSetPart: 'pocket:13' }),
      at('b', 'path', { toolSetPart: 'pocket:13\n' as Cutout['toolSetPart'] }),
      at('c', 'path', { toolSetPart: `pocket:${'9'.repeat(30)}` }),
    ];
    const out = migrateToolSetParts(cutouts, sets, sets);
    expect(out.map((c) => c.toolSetPart)).toEqual(['pocket:13', undefined, undefined]);
  });

  it('releases the parts of a set whose recipe this load dropped', () => {
    const cutouts = [
      at('outer', 'path', { toolSetPart: 'pocket:8' }),
      at('inner', 'path', { parentGroups: ['g1', 'g2'], toolSetPart: 'pocket:8' }),
    ];
    const out = migrateToolSetParts(cutouts, sets, { g1: metric, g2: { family: 'hammer' } });
    expect(out.map((c) => c.toolSetPart)).toEqual(['pocket:8', undefined]);
  });

  it('loads a design whose groups use inherited property names', () => {
    const crafted = [at('a', 'path', { parentGroups: ['constructor'] })];
    expect(migrateToolSetParts(crafted, sets, sets)).toBe(crafted);
  });

  it('leaves cutouts outside a set, and designs without sets, as they are', () => {
    const loose = [at('a', 'path', { parentGroups: ['other'] })];
    expect(migrateToolSetParts(loose, sets, sets)).toBe(loose);
    expect(migrateToolSetParts(loose, undefined, undefined)).toBe(loose);
  });
});
