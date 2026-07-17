import { describe, it, expect } from 'vitest';
import {
  clampCornerCuts,
  cornerCutVertices,
  cornerCutsMatchVertices,
  hasAnyCut,
} from './cornerCutOutline';
import type { CornerCutParams } from '@/core/types';

const NO_CUTS: CornerCutParams = {
  tl: { kind: 'none' },
  tr: { kind: 'none' },
  bl: { kind: 'none' },
  br: { kind: 'none' },
};

const QUARTER_ARC_BULGE = Math.tan(Math.PI / 8);

describe('hasAnyCut', () => {
  it('is false for all-none and true for any cut', () => {
    expect(hasAnyCut(NO_CUTS)).toBe(false);
    expect(hasAnyCut({ ...NO_CUTS, br: { kind: 'chamfer', size: 5 } })).toBe(true);
  });
});

describe('cornerCutVertices', () => {
  it('emits the plain rectangle for all-none cuts', () => {
    expect(cornerCutVertices(100, 80, NO_CUTS)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ]);
  });

  it('emits a quarter arc for a radius cut', () => {
    const verts = cornerCutVertices(100, 80, { ...NO_CUTS, tr: { kind: 'radius', r: 20 } });
    expect(verts).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60, bulge: QUARTER_ARC_BULGE },
      { x: 80, y: 80 },
      { x: 0, y: 80 },
    ]);
  });

  it('emits a diagonal for a chamfer and a step for a notch', () => {
    const verts = cornerCutVertices(100, 80, {
      ...NO_CUTS,
      bl: { kind: 'chamfer', size: 10 },
      br: { kind: 'notch', w: 15, d: 5 },
    });
    expect(verts).toEqual([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 85, y: 0 },
      { x: 85, y: 5 },
      { x: 100, y: 5 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ]);
  });

  it('scales with the rectangle — same cuts, larger extent', () => {
    const cuts: CornerCutParams = { ...NO_CUTS, tl: { kind: 'radius', r: 30 } };
    const small = cornerCutVertices(100, 80, cuts);
    const padded = cornerCutVertices(110, 90, cuts);
    // The tl arc endpoints track the moved corner.
    expect(small.at(-1)).toEqual({ x: 0, y: 50 });
    expect(padded.at(-1)).toEqual({ x: 0, y: 60 });
  });
});

describe('clampCornerCuts', () => {
  it('returns the same cuts when nothing exceeds the bound', () => {
    const cuts: CornerCutParams = { ...NO_CUTS, tl: { kind: 'radius', r: 20 } };
    expect(clampCornerCuts(cuts, 100, 80, 1)).toEqual(cuts);
  });

  it('clamps oversized extents to half the short side minus margin', () => {
    const cuts: CornerCutParams = {
      ...NO_CUTS,
      tl: { kind: 'radius', r: 500 },
      br: { kind: 'notch', w: 500, d: 10 },
    };
    const clamped = clampCornerCuts(cuts, 100, 80, 1);
    expect(clamped.tl).toEqual({ kind: 'radius', r: 39 });
    expect(clamped.br).toEqual({ kind: 'notch', w: 39, d: 10 });
  });
});

describe('cornerCutsMatchVertices', () => {
  const cuts: CornerCutParams = {
    ...NO_CUTS,
    tl: { kind: 'radius', r: 60 },
    br: { kind: 'chamfer', size: 12 },
  };

  it('matches exact regenerated vertices', () => {
    const verts = cornerCutVertices(420, 336, cuts);
    expect(cornerCutsMatchVertices(verts, 420, 336, cuts)).toBe(true);
  });

  it('tolerates store quantization and bounds snap', () => {
    const verts = cornerCutVertices(420, 336, cuts).map((v) => ({
      ...v,
      x: Math.round(v.x / 0.01) * 0.01 + 0.04,
      y: Math.round(v.y / 0.01) * 0.01,
    }));
    expect(cornerCutsMatchVertices(verts, 420, 336, cuts)).toBe(true);
  });

  it('rejects drifted geometry', () => {
    const verts = cornerCutVertices(420, 336, { ...cuts, tl: { kind: 'radius', r: 30 } });
    expect(cornerCutsMatchVertices(verts, 420, 336, cuts)).toBe(false);
  });

  it('rejects a different vertex count', () => {
    const verts = cornerCutVertices(420, 336, cuts).slice(0, -1);
    expect(cornerCutsMatchVertices(verts, 420, 336, cuts)).toBe(false);
  });
});
