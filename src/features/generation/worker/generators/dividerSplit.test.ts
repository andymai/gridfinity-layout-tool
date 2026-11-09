// @vitest-environment node
/**
 * A removable divider longer than the print bed is cut into jointed parts.
 * These pin the contracts a printed set must keep: every part fits the bed,
 * the parts do not overlap, the puzzle tongue reaches across each seam, and a
 * seam never lands in a cross-lap notch.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { box, cut, getBounds, intersect, measureVolume } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildDividerPiece } from './dividerBuilder';
import { exportDividerPiecesSeparately } from './dividerExport';
import {
  DIVIDER_CUT_SHIFT_ALLOWANCE_MM,
  cutSearchOffsets,
  planDividerCuts,
  splitDividerPieceToFit,
  tongueCenters,
} from './dividerSplit';

const vol = (s: Shape3D): number => {
  const r = measureVolume(s);
  return isOk(r) ? r.value : 0;
};

function overlap(a: Shape3D, b: Shape3D): number {
  const i = intersect(a, b);
  if (!isOk(i)) return 0;
  const v = vol(i.value);
  i.value.delete();
  return v;
}

describe('planDividerCuts', () => {
  it('leaves a plate that fits alone', () => {
    expect(planDividerCuts(-80, 80, 200, 2)).toEqual([]);
  });

  it('cuts into equal parts that fit even after the largest allowed shift', () => {
    const cuts = planDividerCuts(-200, 200, 220, 1.65);
    const edges = [-200, ...cuts, 200];
    const shift = DIVIDER_CUT_SHIFT_ALLOWANCE_MM / 2;
    for (let i = 0; i + 1 < edges.length; i++) {
      expect(edges[i + 1] - edges[i] + 2 * shift + 1.65).toBeLessThanOrEqual(220);
    }
    expect(new Set(edges.slice(1).map((e, i) => (e - edges[i]).toFixed(6))).size).toBe(1);
  });

  it('gives up when the bed is shorter than one jointed part', () => {
    expect(planDividerCuts(0, 100, 5, 2)).toEqual([]);
  });
});

describe('cut planning helpers', () => {
  it('tries the planned spot first, then moves outward in both directions', () => {
    expect(cutSearchOffsets().slice(0, 5)).toEqual([0, 1, -1, 2, -2]);
  });

  it('puts two tongues on a tall plate and none on one too short for a head', () => {
    expect(tongueCenters(0, 40, 0.15)).toEqual([10, 30]);
    expect(tongueCenters(0, 10, 0.15)).toEqual([5]);
    expect(tongueCenters(0, 4, 0.15)).toEqual([]);
  });
});

describe('splitDividerPieceToFit', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 60_000);

  it('returns a plate that fits untouched', () => {
    const plate = buildDividerPiece(150, 2, 30);
    const parts = splitDividerPieceToFit(plate, 200);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe(plate);
    plate.delete();
  });

  it('cuts a long plate into non-overlapping parts that fit and lock together', () => {
    const plate = buildDividerPiece(300, 2, 30);
    const original = vol(plate);
    const parts = splitDividerPieceToFit(plate, 200);
    try {
      expect(parts).toHaveLength(2);
      const [a, b] = parts;
      for (const part of parts) {
        const bb = getBounds(part);
        expect(bb.xMax - bb.xMin).toBeLessThanOrEqual(200);
      }
      expect(overlap(a, b)).toBeLessThan(0.01);
      // The tongue on the first part reaches past the seam into the second.
      expect(getBounds(a).xMax).toBeGreaterThan(getBounds(b).xMin);
      // Only the groove clearance is lost.
      const total = vol(a) + vol(b);
      expect(total).toBeLessThan(original);
      expect(total).toBeGreaterThan(original * 0.98);
    } finally {
      for (const p of parts) p.delete();
    }
  });

  it('moves a seam off a cross-lap notch', () => {
    const plain = buildDividerPiece(300, 2, 30);
    const notch = box(2.4, 16, 4, { at: [0, 8, 1] });
    const plate = cut(plain, notch);
    plain.delete();
    notch.delete();
    if (!isOk(plate)) throw new Error('notch cut failed');
    const parts = splitDividerPieceToFit(plate.value, 200);
    try {
      expect(parts).toHaveLength(2);
      // The planned seam was x=0, inside the notch; the first part must end
      // clear of it, so its body stops away from the notch's faces.
      const seam = getBounds(parts[1]).xMin;
      expect(Math.abs(seam)).toBeGreaterThan(1.2);
    } finally {
      for (const p of parts) p.delete();
    }
  });

  it('labels the parts of a long divider in a split export', async () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 7,
      depth: 1,
      style: 'slotted',
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { ...DEFAULT_BIN_PARAMS.slotConfig.x, enabled: true },
        y: { ...DEFAULT_BIN_PARAMS.slotConfig.y, enabled: false },
      },
    };
    const pieces = await exportDividerPiecesSeparately(params, 'stl', 0.05, undefined, 200);
    expect(pieces.map((p) => p.label)).toEqual([
      'divider-horizontal-part-1',
      'divider-horizontal-part-2',
    ]);
  }, 60_000);
});
