import { describe, expect, it } from 'vitest';
import type { Cutout } from '@/shared/types/bin';
import type { ToolSetSpec } from '@/shared/types/toolSet';
import { effectiveSplit } from '@/shared/utils/cutoutSplit';
import { textElementFootprint } from '@/shared/utils/cutoutLabel';
import type { ToolFamily, WrenchSizeEntry } from './catalog';
import { generateToolSet, TOOL_SET_ENTRY_MM, TOOL_SET_WALL_MM } from './generateToolSet';
import { closerThan } from './nestLayout';

function size(key: string, jaw: number): WrenchSizeEntry {
  return {
    key,
    jawMm: jaw,
    lengthMm: 6.2 * jaw + 80,
    openWidthMm: 2 * jaw + 1.5,
    boxWidthMm: 1.35 * jaw + 1.5,
    openThicknessMm: 0.4 * jaw + 1.5,
    boxHeightMm: 0.6 * jaw + 2,
    shankWidthMm: 0.55 * jaw + 3,
  };
}

const family: ToolFamily = {
  id: 'combinationWrench',
  table: {
    jawAngleDeg: 15,
    metric: [size('8', 8), size('10', 10), size('13', 13), size('17', 17), size('19', 19)],
    sae: [],
  },
  presets: { metric: [], sae: [] },
};

const spec: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['19', '8', '13', '10', '17'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

let next = 0;
const opts = {
  setId: 'set-1',
  idFactory: () => `c${next++}`,
  names: { pocket: (s: string) => `${s} mm`, channel: 'Finger channel' },
};

function ringOf(c: Cutout): [number, number][] {
  if (c.path) return c.path.map((p) => [p.x, p.y]);
  return [
    [c.x, c.y],
    [c.x + c.width, c.y],
    [c.x + c.width, c.y + c.depth],
    [c.x, c.y + c.depth],
  ];
}

describe('generateToolSet', () => {
  const set = generateToolSet(spec, family, opts);
  if (!set) throw new Error('expected a set');
  const pockets = set.cutouts.filter((c) => c.shape === 'path');
  const labels = set.cutouts.filter((c) => c.shape === 'text');
  const channels = set.cutouts.filter((c) => c.shape === 'slot');

  it('makes one pocket per size, smallest first, all in the container', () => {
    expect(pockets.map((c) => c.name)).toEqual(['8 mm', '10 mm', '13 mm', '17 mm', '19 mm']);
    expect(set.cutouts.every((c) => c.parentGroups?.[0] === 'set-1' && c.groupId === null)).toBe(
      true
    );
  });

  it('keeps a wall between neighbouring pockets', () => {
    for (let i = 0; i < pockets.length; i++) {
      for (let j = i + 1; j < pockets.length; j++) {
        const flare = 2 * (0.4 + TOOL_SET_ENTRY_MM);
        expect(closerThan(ringOf(pockets[i]), ringOf(pockets[j]), TOOL_SET_WALL_MM + flare)).toBe(
          false
        );
      }
    }
  });

  it('cuts the box end deeper than the handle, on a valid split', () => {
    for (const pocket of pockets) {
      const split = effectiveSplit(pocket);
      expect(split).not.toBeNull();
      expect(split?.cutDepth).toBeGreaterThan(pocket.cutDepth);
    }
  });

  it('engraves each size on the top, clear of every pocket', () => {
    const onFloor = pockets.filter((c) => c.engraveLabel === true).map((c) => c.label);
    expect([...labels.map((c) => c.label), ...onFloor].sort()).toEqual(
      ['10', '13', '17', '19', '8'].sort()
    );
    for (const label of labels) {
      expect(label.width).toBeCloseTo(textElementFootprint(label.label, 5).width, 6);
      for (const pocket of pockets) {
        expect(closerThan(ringOf(pocket), ringOf(label), 1)).toBe(false);
      }
    }
  });

  it('runs one channel across every handle, shallower than the handles', () => {
    expect(channels).toHaveLength(1);
    const channel = channels[0];
    expect(channel.depth).toBeGreaterThan(set.depth * 0.8);
    for (const pocket of pockets) {
      expect(channel.cutDepth).toBeLessThan(pocket.cutDepth);
      expect(closerThan(ringOf(pocket), ringOf(channel), 0)).toBe(true);
    }
  });

  it('starts at the origin and reports its size and deepest cut', () => {
    const minX = Math.min(...set.cutouts.map((c) => c.x - (c.clearance ?? 0)));
    const minY = Math.min(...set.cutouts.map((c) => c.y - (c.clearance ?? 0)));
    expect(minX).toBeCloseTo(0, 1);
    expect(minY).toBeCloseTo(0, 1);
    expect(set.deepestCutMm).toBeCloseTo(0.6 * 19 + 2, 6);
  });

  it('returns null when no size is in the table', () => {
    expect(generateToolSet({ ...spec, sizes: ['99'] }, family, opts)).toBeNull();
  });
});
