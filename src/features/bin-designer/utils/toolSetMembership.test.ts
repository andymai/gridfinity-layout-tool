import { describe, expect, it } from 'vitest';
import type { Cutout, ToolSetSpec } from '../types';
import {
  partsOf,
  releaseClonedParts,
  releaseMovedParts,
  setsWithParts,
  toolSetOf,
} from './toolSetMembership';

const spec: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

function shape(id: string, chain?: string[], toolSetPart?: Cutout['toolSetPart']): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...(chain ? { parentGroups: chain } : {}),
    ...(toolSetPart ? { toolSetPart } : {}),
  };
}

describe('toolSetOf', () => {
  it('names the set every selected cutout sits in', () => {
    const sets = { g1: spec };
    expect(toolSetOf([shape('a', ['x', 'g1'])], sets)).toBe('g1');
    expect(toolSetOf([shape('a', ['g1']), shape('b')], sets)).toBeNull();
    expect(toolSetOf([shape('a', ['x'])], sets)).toBeNull();
    expect(toolSetOf([], sets)).toBeNull();
  });

  it('never takes an inherited property name for a set', () => {
    for (const id of ['constructor', 'toString', '__proto__']) {
      expect(toolSetOf([shape('a', [id])], { g1: spec })).toBeNull();
      expect(partsOf([shape('a', [id], 'channel')], 'g1', { g1: spec })).toEqual([]);
    }
  });

  it('picks the innermost set when one set sits inside another', () => {
    const sets = { outer: spec, inner: spec };
    expect(toolSetOf([shape('a', ['outer', 'inner'])], sets)).toBe('inner');
  });
});

describe('partsOf', () => {
  const sets = { outer: spec, inner: spec };

  it('takes the generated parts of a set, not shapes the user added', () => {
    const cutouts = [shape('a', ['outer'], 'channel'), shape('mine', ['outer'])];
    expect(partsOf(cutouts, 'outer', sets).map((c) => c.id)).toEqual(['a']);
  });

  it('leaves a set nested inside it to that set', () => {
    const cutouts = [shape('a', ['outer'], 'channel'), shape('b', ['outer', 'inner'], 'channel')];
    expect(partsOf(cutouts, 'outer', sets).map((c) => c.id)).toEqual(['a']);
    expect(partsOf(cutouts, 'inner', sets).map((c) => c.id)).toEqual(['b']);
  });

  it('still finds the parts of a set whose recipe is gone', () => {
    const cutouts = [shape('a', ['g1'], 'pocket:13')];
    expect(partsOf(cutouts, 'g1', undefined).map((c) => c.id)).toEqual(['a']);
  });
});

describe('releaseMovedParts', () => {
  const sets = { a: spec, b: spec };

  it('drops the part of a pocket moved into another set, or out of every set', () => {
    const base = { cutouts: [shape('p', ['a'], 'pocket:13'), shape('q', ['a'], 'channel')] };
    const after = {
      cutouts: [shape('p', ['b'], 'pocket:13'), shape('q', [], 'channel')],
      cutoutToolSets: sets,
    };
    const released = releaseMovedParts({ ...base, cutoutToolSets: sets }, after);
    expect(released?.map((c) => c.toolSetPart)).toEqual([undefined, undefined]);
  });

  it('keeps parts that stay in their set, and reports no change', () => {
    const cutouts = [shape('p', ['a'], 'pocket:13')];
    const nested = [shape('p', ['a', 'box'], 'pocket:13')];
    expect(
      releaseMovedParts(
        { cutouts, cutoutToolSets: sets },
        { cutouts: nested, cutoutToolSets: sets }
      )
    ).toBeNull();
  });

  it('keeps a loose part that joins a set created in the same edit', () => {
    const cutouts = [shape('p', ['copy'], 'pocket:13')];
    const base = { cutouts, cutoutToolSets: { a: spec } };
    expect(
      releaseMovedParts(base, { cutouts, cutoutToolSets: { a: spec, copy: spec } })
    ).toBeNull();
    const intoA = [shape('p', ['a'], 'pocket:13')];
    const loose = { cutouts: [shape('p', ['x'], 'pocket:13')], cutoutToolSets: { a: spec } };
    expect(
      releaseMovedParts(loose, { cutouts: intoA, cutoutToolSets: { a: spec } })?.[0].toolSetPart
    ).toBeUndefined();
  });

  it('leaves new cutouts alone: a fresh set has no earlier owner', () => {
    const after = { cutouts: [shape('new', ['a'], 'pocket:13')], cutoutToolSets: sets };
    expect(releaseMovedParts({ cutouts: [], cutoutToolSets: sets }, after)).toBeNull();
  });
});

describe('releaseClonedParts', () => {
  it('keeps parts copied with their whole set, and drops the rest', () => {
    const sets = { a: spec, copy: spec };
    const cutouts = [
      shape('whole', ['copy'], 'pocket:13'),
      shape('loose', ['fresh'], 'pocket:10'),
      shape('intoA', ['a'], 'pocket:8'),
      shape('kept', ['a'], 'pocket:8'),
    ];
    const out = releaseClonedParts(
      cutouts,
      new Set(['whole', 'loose', 'intoA']),
      new Set(['copy']),
      sets
    );
    expect(out?.map((c) => c.toolSetPart)).toEqual(['pocket:13', undefined, undefined, 'pocket:8']);
  });
});

describe('setsWithParts', () => {
  it('drops the recipe of a set with no part left, and reports no change otherwise', () => {
    const sets = { a: spec, b: spec };
    const cutouts = [shape('p', ['a'], 'pocket:13'), shape('mine', ['b'])];
    expect(setsWithParts(cutouts, sets)).toEqual({ a: spec });
    expect(setsWithParts([shape('mine', ['b'])], { b: spec })).toBeUndefined();
    expect(setsWithParts(cutouts, { a: spec })).toBeNull();
    expect(setsWithParts(cutouts, undefined)).toBeNull();
  });
});
