// @vitest-environment node
/**
 * A removable divider longer than the print bed is cut into jointed parts.
 * These pin the contracts a printed set must keep: every part fits the bed,
 * the parts do not overlap, a puzzle tongue reaches across every seam, and a
 * seam whose plate is notched or patterned still gets its tongue.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { box, cut, getBounds, intersect, measureVolume } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isErr, isOk } from '@/core/result';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/shared/types/bin';
import { dividerInterior } from '@/shared/utils/slotMath';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildDividerPiece, buildUniqueDividerPieces } from './dividerBuilder';
import { exportDividerPiecesSeparately } from './dividerExport';
import { partLengthBudget } from './dividerSeamPlan';
import { splitDividerPieceAtSeams } from './dividerSplit';
import { deriveDimensions } from './pipeline/context';

const BED = { widthMm: 200, depthMm: 200 };

const vol = (s: Shape3D): number => {
  const r = measureVolume(s);
  return isOk(r) ? r.value : 0;
};

function volumeIn(shape: Shape3D, region: Shape3D): number {
  const i = intersect(shape, region);
  region.delete();
  if (!isOk(i)) return 0;
  const v = vol(i.value);
  i.value.delete();
  return v;
}

function notched(plate: Shape3D, tool: Shape3D): Shape3D {
  const r = cut(plate, tool);
  plate.delete();
  tool.delete();
  if (!isOk(r)) throw new Error('notch cut failed');
  return r.value;
}

/** Each part fits the bed, the parts do not overlap, and each tongue crosses its seam. */
function expectLockingParts(parts: readonly Shape3D[], budget: number): void {
  expect(parts.length).toBeGreaterThan(1);
  for (const part of parts) {
    const bb = getBounds(part);
    expect(bb.xMax - bb.xMin).toBeLessThanOrEqual(budget);
  }
  for (let i = 0; i + 1 < parts.length; i++) {
    const a = getBounds(parts[i]);
    const b = getBounds(parts[i + 1]);
    expect(a.xMax).toBeGreaterThan(b.xMin + 1);
    const overlap = intersect(parts[i], parts[i + 1]);
    const v = isOk(overlap) ? vol(overlap.value) : 0;
    if (isOk(overlap)) overlap.value.delete();
    expect(v).toBeLessThan(0.01);
  }
}

function slottedParams(overrides: Partial<BinParams>): BinParams {
  return { ...DEFAULT_BIN_PARAMS, height: 6, style: 'slotted', ...overrides };
}

function splitPieces(params: BinParams): { label: string; parts: Shape3D[] }[] {
  const { wallHeight } = deriveDimensions(params, true);
  const { innerW, innerD } = dividerInterior(params);
  const pieces = buildUniqueDividerPieces(
    params,
    innerW,
    innerD,
    wallHeight,
    params.base.stackingLip,
    { printBed: BED }
  );
  return pieces.map((p) => {
    const split = splitDividerPieceAtSeams(p.shape, p.seams ?? []);
    if (!isOk(split)) {
      p.shape.delete();
      throw split.error;
    }
    return { label: p.label, parts: split.value };
  });
}

describe('splitDividerPieceAtSeams', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 60_000);

  it('returns a piece with no seams untouched', () => {
    const plate = buildDividerPiece(150, 2, 30);
    const split = splitDividerPieceAtSeams(plate, []);
    expect(isOk(split) && split.value[0]).toBe(plate);
    plate.delete();
  });

  it('cuts a long plate into parts that fit and lock together', () => {
    const plate = buildDividerPiece(300, 2, 30);
    const original = vol(plate);
    const split = splitDividerPieceAtSeams(plate, [0]);
    if (!isOk(split)) throw split.error;
    try {
      expectLockingParts(split.value, 200);
      const total = split.value.reduce((sum, p) => sum + vol(p), 0);
      // Only the groove clearance is lost.
      expect(total).toBeLessThan(original);
      expect(total).toBeGreaterThan(original * 0.98);
    } finally {
      for (const p of split.value) p.delete();
    }
  });

  it('moves the tongue into the solid half when the seam is notched', () => {
    // A cross-lap notch from the top edge, across the whole joint.
    const plate = notched(buildDividerPiece(300, 2, 30), box(12, 15, 4, { at: [0, 7.5, 1] }));
    const split = splitDividerPieceAtSeams(plate, [0]);
    if (!isOk(split)) throw split.error;
    const [left, right] = split.value;
    try {
      expectLockingParts(split.value, 200);
      const pastSeam = (yLo: number, yHi: number): Shape3D =>
        box(3, yHi - yLo, 4, { at: [1.5, (yLo + yHi) / 2, 1] });
      expect(volumeIn(left, pastSeam(-15, 0))).toBeGreaterThan(1);
      expect(volumeIn(left, pastSeam(0, 15))).toBeLessThan(0.01);
    } finally {
      left.delete();
      right.delete();
    }
  });

  it('leaves the piece whole when no band at the seam is solid', () => {
    const plate = notched(buildDividerPiece(300, 2, 30), box(3, 40, 4, { at: [1, 0, 1] }));
    const before = vol(plate);
    const split = splitDividerPieceAtSeams(plate, [0]);
    expect(isErr(split)).toBe(true);
    expect(vol(plate)).toBeCloseTo(before, 3);
    plate.delete();
  });
});

describe('dividers cut to fit a split export', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 60_000);

  it('joins a long cross-lap divider at the minimum slot pitch', () => {
    const params = slottedParams({
      width: 7,
      depth: 1,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 10 },
        crossStyle: 'lap',
      },
    });
    const pieces = splitPieces(params);
    try {
      const long = pieces.find((p) => p.label === 'divider-horizontal');
      if (!long) throw new Error('no horizontal divider');
      const height = getBounds(long.parts[0]).yMax - getBounds(long.parts[0]).yMin;
      expectLockingParts(long.parts, partLengthBudget(height, BED) ?? 0);
    } finally {
      for (const p of pieces) for (const s of p.parts) s.delete();
    }
  }, 120_000);

  it('joins a long divider that carries the wall pattern', () => {
    const params = slottedParams({
      width: 7,
      depth: 1,
      wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, dividers: true },
    });
    const pieces = splitPieces(params);
    try {
      expect(pieces).toHaveLength(1);
      expectLockingParts(pieces[0].parts, 200);
    } finally {
      for (const p of pieces) for (const s of p.parts) s.delete();
    }
  }, 120_000);

  it('labels the parts of a long divider', async () => {
    const params = slottedParams({ width: 7, depth: 1 });
    const pieces = await exportDividerPiecesSeparately(params, 'stl', 0.05, undefined, {
      printBed: BED,
    });
    expect(pieces.map((p) => p.label)).toEqual([
      'divider-horizontal-part-1',
      'divider-horizontal-part-2',
    ]);
  }, 60_000);
});
