import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { isOk, isErr } from '@/core/result';
import { expandToFit } from './expandToFit';
import { makeLayout, makeBin } from './_testHelpers';
import { gridUnits } from '@/core/types';
import type { Bin, Layout } from '@/core/types';

/** Three 2u bins in a 7u-wide, 2u-deep drawer — one row, slack on X only. */
function threeAcrossSeven(): { layout: Layout; bins: Bin[] } {
  const bins = [0, 2, 4].map((x, i) =>
    makeBin(`bin_${i}`, {
      x: gridUnits(x),
      y: gridUnits(0),
      width: gridUnits(2),
      depth: gridUnits(2),
    })
  );
  const layout = makeLayout({
    drawer: { width: gridUnits(7), depth: gridUnits(2), height: makeLayout().drawer.height },
    bins,
  });
  return { layout, bins };
}

const ids = (bins: Bin[]): string[] => bins.map((b) => b.id);

describe('v2 bin.expandToFit', () => {
  it('tiles the span exactly, leaving no gap between bodies', () => {
    const { layout, bins } = threeAcrossSeven();

    const result = expandToFit.handle({ ids: ids(bins) }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const { placements } = result.value.event.payload;
    expect(placements).toHaveLength(3);

    const pitch = layout.gridUnitMm;
    const bodies = placements
      .map((p) => {
        const bin = bins.find((b) => b.id === p.id);
        if (!bin) throw new Error('placement for unknown bin');
        return {
          start: p.x * pitch - p.overhang.left,
          end: (p.x + bin.width) * pitch + p.overhang.right,
        };
      })
      .sort((a, b) => a.start - b.start);

    expect(bodies[0].start).toBeCloseTo(0);
    expect(bodies[bodies.length - 1].end).toBeCloseTo(7 * pitch);
    for (let i = 1; i < bodies.length; i++) {
      expect(bodies[i].start).toBeCloseTo(bodies[i - 1].end);
    }
  });

  it('splits the slack evenly and keeps footprints on the half-unit grid', () => {
    const { layout, bins } = threeAcrossSeven();

    const result = expandToFit.handle({ ids: ids(bins) }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const byId = new Map(result.value.event.payload.placements.map((p) => [p.id, p]));
    expect(byId.get(bins[0].id)?.x).toBeCloseTo(0);
    expect(byId.get(bins[1].id)?.x).toBeCloseTo(2.5);
    expect(byId.get(bins[2].id)?.x).toBeCloseTo(5);

    // 42mm of slack over three bins = 14mm of body growth each.
    for (const p of result.value.event.payload.placements) {
      const grown = p.overhang.left + p.overhang.right;
      expect(grown).toBeCloseTo(14);
      expect(p.overhang.enabled).toBe(true);
    }
  });

  it('produces a state no sequential per-bin update could reach', () => {
    // The reason this is one command and not a batch of bin.update calls: at
    // least one resolved footprint lands on ground another selected bin has
    // not vacated yet, so any ordering hits an invalid intermediate state.
    const { layout, bins } = threeAcrossSeven();

    const result = expandToFit.handle({ ids: ids(bins) }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');
    const { placements } = result.value.event.payload;

    const overlaps = (aLo: number, aHi: number, bLo: number, bHi: number): boolean =>
      aLo < bHi - 1e-9 && bLo < aHi - 1e-9;

    const conflictsWithAnOldFootprint = placements.some((p) => {
      const moved = bins.find((b) => b.id === p.id);
      if (!moved) return false;
      return bins.some(
        (other) =>
          other.id !== p.id && overlaps(p.x, p.x + moved.width, other.x, other.x + other.width)
      );
    });
    expect(conflictsWithAnOldFootprint).toBe(true);

    // ...while the resolved footprints themselves are disjoint.
    const sorted = placements
      .map((p) => {
        const bin = bins.find((b) => b.id === p.id);
        if (!bin) throw new Error('placement for unknown bin');
        return { lo: p.x, hi: p.x + bin.width };
      })
      .sort((a, b) => a.lo - b.lo);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].lo).toBeGreaterThanOrEqual(sorted[i - 1].hi - 1e-9);
    }
  });

  it('carries the blocked reason on the error when there is no slack', () => {
    // A 2u bin filling a 2u-square drawer has nothing to absorb.
    const bin = makeBin('bin_full', { width: gridUnits(2), depth: gridUnits(2) });
    const layout = makeLayout({
      drawer: { width: gridUnits(2), depth: gridUnits(2), height: makeLayout().drawer.height },
      bins: [bin],
    });

    const result = expandToFit.handle({ ids: [bin.id] }, { aggregate: layout });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
    if (result.error.code !== 'LAYOUT_INVALID_OPERATION') return;
    expect(result.error.reason).toBe('no-slack');
  });

  it('reports a ragged selection rather than expanding part of it', () => {
    // An L-shape: lane intersections don't all resolve to one bin.
    const bins = [
      makeBin('bin_a', { x: gridUnits(0), y: gridUnits(0) }),
      makeBin('bin_b', { x: gridUnits(1), y: gridUnits(0) }),
      makeBin('bin_c', { x: gridUnits(0), y: gridUnits(1) }),
    ];
    const layout = makeLayout({ bins });

    const result = expandToFit.handle({ ids: ids(bins) }, { aggregate: layout });
    expect(isErr(result)).toBe(true);
    if (!isErr(result)) return;
    if (result.error.code !== 'LAYOUT_INVALID_OPERATION') return;
    expect(result.error.reason).toBe('ragged');
  });

  it('apply() writes every placement, and previous captures the prior state', () => {
    const { layout, bins } = threeAcrossSeven();

    const result = expandToFit.handle({ ids: ids(bins) }, { aggregate: layout });
    if (!isOk(result)) throw new Error('handle failed');

    const applied = produce(layout, (draft) => {
      expandToFit.apply({ type: 'bin.expandedToFit', payload: result.value.event.payload }, draft);
    });

    for (const p of result.value.event.payload.placements) {
      const bin = applied.bins.find((b) => b.id === p.id);
      expect(bin?.x).toBeCloseTo(p.x);
      expect(bin?.y).toBeCloseTo(p.y);
      expect(bin?.overhang).toEqual(p.overhang);
    }

    const previous = result.value.event.payload.previous;
    expect(previous).toHaveLength(3);
    for (const prev of previous) {
      const original = bins.find((b) => b.id === prev.id);
      expect(prev.x).toBeCloseTo(original?.x ?? -1);
      expect(prev.overhang).toBeUndefined();
    }
  });

  it('expands a lone bin into the space around it', () => {
    // 1u bin in a 2u-square drawer: it should claim the whole thing.
    const bin = makeBin('bin_solo');
    const layout = makeLayout({
      drawer: { width: gridUnits(2), depth: gridUnits(2), height: makeLayout().drawer.height },
      bins: [bin],
    });

    const result = expandToFit.handle({ ids: [bin.id] }, { aggregate: layout });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.value).toBe(1);
    const [p] = result.value.event.payload.placements;
    const pitch = layout.gridUnitMm;
    expect(p.x * pitch - p.overhang.left).toBeCloseTo(0);
    expect((p.x + 1) * pitch + p.overhang.right).toBeCloseTo(2 * pitch);
  });
});
