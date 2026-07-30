import { describe, it, expect } from 'vitest';
import { resolveExpandToFit } from './expandToFit';
import type { ExpandPlacement } from './expandToFit';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits, layerId, mm } from '@/core/types';
import type { Bin, BinId, Layout, StoredBaseplateParams } from '@/core/types';

const LAYER = layerId('layer-1');

function layout(width: number, depth: number, extra: Partial<Layout> = {}): Layout {
  const base = createTestLayout();
  return {
    ...base,
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
    drawer: { width: gridUnits(width), depth: gridUnits(depth), height: heightUnits(6) },
    layers: [{ id: LAYER, name: 'L1', height: heightUnits(6) }],
    bins: [],
    ...extra,
  };
}

let seq = 0;
function bin(x: number, y: number, w: number, d: number, over: Partial<Bin> = {}): Bin {
  seq += 1;
  return createTestBin({
    id: binId(`bin_${seq}`),
    layerId: LAYER,
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(w),
    depth: gridUnits(d),
    ...over,
  });
}

function baseplate(o: Partial<StoredBaseplateParams> = {}): StoredBaseplateParams {
  return {
    magnetHoles: false,
    magnetDiameter: mm(6),
    magnetDepth: mm(2),
    paddingLeft: mm(0),
    paddingRight: mm(0),
    paddingFront: mm(0),
    paddingBack: mm(0),
    ...o,
  };
}

/** The placement for a bin, or a failed assertion — keeps the body maths free of
 *  undefined-handling noise. */
function placementFor(placements: readonly ExpandPlacement[], id: BinId): ExpandPlacement {
  const found = placements.find((p) => p.binId === id);
  if (!found) throw new Error(`no placement for ${id}`);
  return found;
}

/** A placement's body extent along X, in mm. */
function bodyX(p: ExpandPlacement, w: number): { start: number; end: number } {
  const start = p.x * 42 - p.overhang.left;
  return { start, end: start + w * 42 + p.overhang.left + p.overhang.right };
}

describe('resolveExpandToFit — the reported scenario', () => {
  // IKEA Alex, 7 units wide, three columns of sleeved trading cards. 294/3 = 98mm,
  // which is 2 1/3 grid units and therefore not expressible as a footprint.
  it('splits a 7-unit width into three 98mm columns', () => {
    const bins = [bin(0, 0, 2, 12), bin(2, 0, 2, 12), bin(4, 0, 2, 12)];
    const l = layout(7, 12, { bins });

    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.placements.map((p) => [p.binId, p]));

    expect(byId.get(bins[0].id)).toMatchObject({ x: 0 });
    expect(byId.get(bins[1].id)).toMatchObject({ x: 2.5 });
    expect(byId.get(bins[2].id)).toMatchObject({ x: 5 });

    // Every body is exactly 98mm and they tile 0..294 with no gaps.
    const bodies = bins.map((b) => bodyX(placementFor(result.placements, b.id), 2));
    for (const body of bodies) expect(body.end - body.start).toBeCloseTo(98, 6);
    expect(bodies[0].start).toBeCloseTo(0, 6);
    expect(bodies[0].end).toBeCloseTo(bodies[1].start, 6);
    expect(bodies[1].end).toBeCloseTo(bodies[2].start, 6);
    expect(bodies[2].end).toBeCloseTo(294, 6);
  });

  it('gives the middle column symmetric feet and the outer ones a single ledge', () => {
    const bins = [bin(0, 0, 2, 12), bin(2, 0, 2, 12), bin(4, 0, 2, 12)];
    const l = layout(7, 12, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = new Map(result.placements.map((p) => [p.binId, p]));

    expect(byId.get(bins[0].id)?.overhang).toMatchObject({ left: 0, right: 14 });
    expect(byId.get(bins[1].id)?.overhang).toMatchObject({ left: 7, right: 7 });
    expect(byId.get(bins[2].id)?.overhang).toMatchObject({ left: 14, right: 0 });
  });

  it('never adds feet under the overhang', () => {
    const bins = [bin(0, 0, 2, 12), bin(2, 0, 2, 12), bin(4, 0, 2, 12)];
    const l = layout(7, 12, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.placements) expect(p.overhang.feet).toBe(false);
  });
});

describe('resolveExpandToFit — span growth', () => {
  it('grows past gaps to the drawer edge when nothing blocks', () => {
    // Three 2u bins packed at the left of a 7u drawer still reach x=7.
    const bins = [bin(0, 0, 2, 4), bin(2, 0, 2, 4), bin(4, 0, 2, 4)];
    const l = layout(7, 4, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const body = bodyX(placementFor(result.placements, bins[2].id), 2);
    expect(body.end).toBeCloseTo(294, 6);
  });

  it('stops at a neighbouring bin instead of the wall', () => {
    const selected = [bin(0, 0, 2, 4), bin(2, 0, 2, 4)];
    const blocker = bin(6, 0, 1, 4);
    const all = [...selected, blocker];
    const l = layout(7, 4, { bins: all });
    const result = resolveExpandToFit(
      all,
      selected.map((b) => b.id),
      l,
      undefined
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Span is 0..6u = 252mm over two bins → 126mm each, not 147mm.
    const body = bodyX(placementFor(result.placements, selected[0].id), 2);
    expect(body.end - body.start).toBeCloseTo(126, 6);
  });

  it('claims baseplate padding when the span reaches a drawer edge', () => {
    const bins = [bin(0, 0, 2, 4), bin(2, 0, 2, 4), bin(4, 0, 2, 4)];
    const l = layout(7, 4, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      baseplate({ paddingLeft: mm(6), paddingRight: mm(6) })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 294 + 12 = 306mm over three bins → 102mm each.
    for (const b of bins) {
      const body = bodyX(placementFor(result.placements, b.id), 2);
      expect(body.end - body.start).toBeCloseTo(102, 6);
    }
  });
});

describe('resolveExpandToFit — single bin', () => {
  it('absorbs the gap around one bin', () => {
    const selected = bin(0, 0, 2, 4);
    const blocker = bin(3, 0, 1, 4);
    const all = [selected, blocker];
    const l = layout(7, 4, { bins: all });
    const result = resolveExpandToFit(all, [selected.id], l, undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Span 0..3u = 126mm; a 2u socket leaves 42mm of slack, capped per side at 21.
    const body = bodyX(result.placements[0], 2);
    expect(body.start).toBeCloseTo(0, 6);
    expect(body.end).toBeCloseTo(126, 6);
  });
});

describe('resolveExpandToFit — blocked', () => {
  it('reports no-slack when the bins already meet their neighbours', () => {
    const bins = [bin(0, 0, 2, 4), bin(2, 0, 2, 4)];
    const l = layout(4, 4, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result).toEqual({ ok: false, reason: 'no-slack' });
  });

  it('reports slack-exceeds-overhang when the bins are too small for the span', () => {
    // One 1u bin in a 7u drawer: 294 - 42 = 252mm of slack, 126 per side.
    const only = bin(0, 0, 1, 4);
    const l = layout(7, 4, { bins: [only] });
    const result = resolveExpandToFit([only], [only.id], l, undefined);
    expect(result).toEqual({ ok: false, reason: 'slack-exceeds-overhang' });
  });

  // Sub-millimetre padding on an exactly-filled grid: the span starts off-grid
  // and each share (0.67mm) is a fraction of a half-unit, so no legal socket
  // origin fits its slice. Distinct from 'ragged' — the selection is fine, the
  // arithmetic just has nowhere to put the feet.
  it('reports no-grid-alignment when the slack cannot hold a socket origin', () => {
    const bins = [bin(0, 0, 1, 4), bin(1, 0, 1, 4), bin(2, 0, 1, 4)];
    const l = layout(3, 4, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      baseplate({ paddingLeft: mm(1), paddingRight: mm(1) })
    );
    expect(result).toEqual({ ok: false, reason: 'no-grid-alignment' });
  });

  it('rejects a ragged (non-grid) selection', () => {
    // L-shape: lanes imply a 2x2 grid but only 3 bins are present.
    const bins = [bin(0, 0, 1, 1), bin(1, 0, 1, 1), bin(0, 1, 1, 1)];
    const l = layout(7, 7, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result).toEqual({ ok: false, reason: 'ragged' });
  });

  it('rejects a selection spanning two layers', () => {
    const other = layerId('layer-2');
    const a = bin(0, 0, 1, 1);
    const b = bin(2, 0, 1, 1, { layerId: other });
    const l = layout(7, 7, {
      bins: [a, b],
      layers: [
        { id: LAYER, name: 'L1', height: heightUnits(6) },
        { id: other, name: 'L2', height: heightUnits(6) },
      ],
    });
    const result = resolveExpandToFit([a, b], [a.id, b.id], l, undefined);
    expect(result).toEqual({ ok: false, reason: 'ragged' });
  });

  it('ignores staging bins', () => {
    const staged = bin(0, 0, 1, 1, { layerId: STAGING_ID });
    const l = layout(7, 7, { bins: [staged] });
    const result = resolveExpandToFit([staged], [staged.id], l, undefined);
    expect(result).toEqual({ ok: false, reason: 'ragged' });
  });

  it('rejects a column whose bins differ in width', () => {
    const bins = [bin(0, 0, 1, 1), bin(0, 2, 2, 1)];
    const l = layout(7, 7, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result).toEqual({ ok: false, reason: 'ragged' });
  });
});

describe('resolveExpandToFit — invariants', () => {
  // The property that makes zero gaps structural rather than a rounding
  // accident: the body always spans its slice, whatever the socket position.
  // Drawer width scales with the count so the per-bin slack stays inside the
  // 21mm cap: n bins of 1.5u (63mm) in a 2n-unit drawer leaves 21mm each.
  it('tiles exactly for every column count', () => {
    for (const n of [2, 3, 4, 5]) {
      const bins = Array.from({ length: n }, (_, i) => bin(i * 1.5, 0, 1.5, 4));
      const l = layout(n * 2, 4, { bins });
      const result = resolveExpandToFit(
        bins,
        bins.map((b) => b.id),
        l,
        undefined
      );
      expect(result.ok, `n=${n}`).toBe(true);
      if (!result.ok) continue;
      const bodies = bins.map((b) => bodyX(placementFor(result.placements, b.id), 1.5));
      // Seams meet exactly, and the run covers the whole drawer.
      expect(bodies[0].start, `n=${n} start`).toBeCloseTo(0, 6);
      for (let i = 1; i < bodies.length; i++) {
        expect(bodies[i].start, `n=${n} seam ${i}`).toBeCloseTo(bodies[i - 1].end, 6);
      }
      expect(bodies[bodies.length - 1].end, `n=${n} end`).toBeCloseTo(n * 2 * 42, 6);
    }
  });

  it('keeps every side within the 21mm outward cap', () => {
    const bins = [bin(0, 0, 2, 4), bin(2, 0, 2, 4), bin(4, 0, 2, 4)];
    const l = layout(7, 4, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.placements) {
      for (const side of [p.overhang.left, p.overhang.right, p.overhang.front, p.overhang.back]) {
        expect(side).toBeGreaterThanOrEqual(0);
        expect(side).toBeLessThanOrEqual(21);
      }
    }
  });

  it('leaves an axis with no slack untouched', () => {
    // 7 wide (slack) x 4 deep (exactly filled): only X should gain overhang.
    const bins = [bin(0, 0, 2, 4), bin(2, 0, 2, 4), bin(4, 0, 2, 4)];
    const l = layout(7, 4, { bins });
    const result = resolveExpandToFit(
      bins,
      bins.map((b) => b.id),
      l,
      undefined
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const p of result.placements) {
      expect(p.overhang.front).toBeCloseTo(0, 6);
      expect(p.overhang.back).toBeCloseTo(0, 6);
      expect(p.y).toBe(0);
    }
  });
});
