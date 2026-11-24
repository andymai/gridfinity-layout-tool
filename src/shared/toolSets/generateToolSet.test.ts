import { describe, expect, it } from 'vitest';
import type { Cutout } from '@/shared/types/bin';
import type { ToolSetSpec } from '@/shared/types/toolSet';
import { effectiveSplit } from '@/shared/utils/cutoutSplit';
import { textElementFootprint } from '@/shared/utils/cutoutLabel';
import type { ToolFamily, WrenchSizeEntry } from './catalog';
import { MAX_PATH_POINTS, MIN_PATH_POINTS } from '@/shared/types/bin';
import { setLimitOnBed, TOOL_FAMILIES } from './catalog';
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
  idFor: () => `c${next++}`,
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

  it('marks each cutout with its part and asks for its id by part', () => {
    const byPart = generateToolSet(spec, family, { ...opts, idFor: (part) => `id:${part}` });
    if (!byPart) throw new Error('expected a set');
    const parts = byPart.cutouts.map((c) => c.toolSetPart);
    expect(new Set(parts).size).toBe(parts.length);
    expect(parts).toEqual(expect.arrayContaining(['pocket:8', 'pocket:19', 'channel']));
    for (const c of byPart.cutouts) expect(c.id).toBe(`id:${String(c.toolSetPart)}`);
  });

  it('reports a channel it could not fit across the handles', () => {
    const stubby: ToolFamily = {
      ...family,
      table: { ...family.table, metric: [{ ...size('19', 19), lengthMm: 72 }] },
    };
    const set = generateToolSet({ ...spec, sizes: ['19'] }, stubby, opts);
    expect(set?.channelDropped).toBe(true);
    expect(set?.cutouts.some((c) => c.shape === 'slot')).toBe(false);
    expect(
      generateToolSet({ ...spec, sizes: ['19'], fingerChannel: false }, stubby, opts)
        ?.channelDropped
    ).toBe(false);
  });
});

describe('generateToolSet on the real tables', () => {
  it.each(['metric', 'sae'] as const)(
    'keeps every %s pocket within the path point limit',
    (units) => {
      const family = TOOL_FAMILIES.combinationWrench;
      let n = 0;
      const set = generateToolSet(
        { ...spec, units, sizes: family.table[units].map((e) => e.key) },
        family,
        { setId: 's', idFor: () => `r${n++}`, names: opts.names }
      );
      if (!set) throw new Error('expected a set');
      const pockets = set.cutouts.filter((c) => c.shape === 'path');
      expect(pockets).toHaveLength(family.table[units].length);
      for (const pocket of pockets) {
        expect(pocket.path?.length ?? 0).toBeLessThanOrEqual(MAX_PATH_POINTS);
        expect(pocket.path?.length ?? 0).toBeGreaterThanOrEqual(MIN_PATH_POINTS);
      }
    }
  );
});

describe('generateToolSet on the real presets', () => {
  const real = TOOL_FAMILIES.combinationWrench;
  const presets = (['metric', 'sae'] as const).flatMap((units) =>
    real.presets[units].map((sizes) => ({ units, sizes }))
  );

  it.each(presets)('fits a channel across the $units set $sizes', ({ units, sizes }) => {
    let n = 0;
    const set = generateToolSet({ ...spec, units, sizes: [...sizes] }, real, {
      ...opts,
      idFor: () => `p${n++}`,
    });
    expect(set?.channelDropped).toBe(false);
    expect(set?.cutouts.filter((c) => c.shape === 'slot')).toHaveLength(1);
  });

  it('picks a layout that stays on the bed with its engraved sizes', () => {
    const sizes = [...(real.presets.metric.at(0) ?? [])];
    const maxWidthMm = setLimitOnBed(300);
    let n = 0;
    const free = generateToolSet({ ...spec, sizes }, real, { ...opts, idFor: () => `f${n++}` });
    const capped = generateToolSet({ ...spec, sizes }, real, {
      ...opts,
      idFor: () => `b${n++}`,
      maxWidthMm,
    });
    expect(free?.width).toBeGreaterThan(maxWidthMm);
    expect(capped?.width).toBeLessThanOrEqual(maxWidthMm);
    expect(capped?.cutouts.some((c) => c.shape === 'text')).toBe(true);
  });
});

describe('generateToolSet layout cache', () => {
  it('never hands one table the layout of another with the same size keys', () => {
    const bigger: ToolFamily = {
      ...family,
      table: {
        ...family.table,
        metric: family.table.metric.map((e) => ({ ...e, lengthMm: e.lengthMm + 40 })),
      },
    };
    const a = generateToolSet(spec, family, opts);
    const b = generateToolSet(spec, bigger, opts);
    expect(b?.width).toBeGreaterThan((a?.width ?? 0) + 30);
  });

  it('gives the same pockets when only the engraving changes', () => {
    const a = generateToolSet(spec, family, opts);
    const b = generateToolSet({ ...spec, labelSizeMm: 0 }, family, opts);
    const paths = (set: typeof a) =>
      set?.cutouts.filter((c) => c.shape === 'path').map((c) => c.path) ?? [];
    expect(paths(b)).toEqual(paths(a));
  });
});
