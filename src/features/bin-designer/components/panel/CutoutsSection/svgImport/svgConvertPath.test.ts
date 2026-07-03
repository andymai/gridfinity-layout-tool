import { describe, it, expect } from 'vitest';
import { convertPath } from './svgConvertPath';
import { IDENTITY } from './svgTransform';
import type { Matrix } from './svgTransform';
import type { ViewBox } from './types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VIEW_BOX: ViewBox = { minX: 0, minY: 0, width: 100, height: 100 };

function makePath(d: string): Element {
  const el = document.createElement('path');
  el.setAttribute('d', d);
  return el;
}

// ─── convertPath ─────────────────────────────────────────────────────────────

describe('convertPath', () => {
  it('returns null when the element has no d attribute', () => {
    const el = document.createElement('path');
    expect(convertPath(el, IDENTITY, VIEW_BOX)).toBeNull();
  });

  it('returns null for a move-only path (no drawable geometry)', () => {
    // "M 5 5" produces a contour with only 1 command — convertContour returns null
    expect(convertPath(makePath('M 5 5'), IDENTITY, VIEW_BOX)).toBeNull();
  });

  it('simple M L L Z triangle produces one path spec with 3 points', () => {
    const result = convertPath(makePath('M 10 10 L 90 10 L 50 80 Z'), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].shape).toBe('path');
    expect(result![0].path).toHaveLength(3);
  });

  it('all path point coordinates are Number.isFinite', () => {
    const result = convertPath(makePath('M 0 0 L 10 0 L 5 10 Z'), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    const path = result![0].path;
    // Assert path exists/non-empty so the finite checks can't pass vacuously
    // (a path spec without a `path` array would otherwise skip the loop).
    expect(path).toBeDefined();
    expect(path?.length).toBeGreaterThan(0);
    for (const pt of path ?? []) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });

  it('Y axis is flipped: M 10 10 maps to y = viewHeight - 10', () => {
    // transformPoint(10, 10, IDENTITY, {0,0,100,100}) → (10, 100-10) = (10, 90)
    const result = convertPath(makePath('M 10 10 L 90 10 L 50 80 Z'), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    const pt = result![0].path![0];
    expect(pt.x).toBeCloseTo(10, 5);
    expect(pt.y).toBeCloseTo(90, 5);
  });

  it('translate matrix shifts all path point x-coordinates by the translation', () => {
    const tx: Matrix = [1, 0, 0, 1, 20, 0];
    const base = convertPath(makePath('M 10 10 L 90 10 L 50 80 Z'), IDENTITY, VIEW_BOX);
    const shifted = convertPath(makePath('M 10 10 L 90 10 L 50 80 Z'), tx, VIEW_BOX);
    expect(base).not.toBeNull();
    expect(shifted).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      expect(shifted![0].path![i].x).toBeCloseTo(base![0].path![i].x + 20, 5);
      // Y coordinates are unaffected by a pure x-translate
      expect(shifted![0].path![i].y).toBeCloseTo(base![0].path![i].y, 5);
    }
  });

  it('two M sub-paths produce two specs', () => {
    const d = 'M 0 0 L 10 0 L 5 10 Z M 20 0 L 30 0 L 25 10 Z';
    const result = convertPath(makePath(d), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].shape).toBe('path');
    expect(result![1].shape).toBe('path');
  });

  it('C (cubic bezier) command adds handles to the adjacent path points', () => {
    // M 0 0 C 0 50 100 50 100 0 — a smooth arch
    const result = convertPath(makePath('M 0 0 C 0 50 100 50 100 0'), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    const path = result![0].path ?? [];
    expect(path.length).toBeGreaterThanOrEqual(2);
    const hasHandle = path.some((pt) => pt.handleOut !== null || pt.handleIn !== null);
    expect(hasHandle).toBe(true);
  });

  it('C command assigns correct handleOut on the preceding point', () => {
    // M 0 0 C 0 50 100 50 100 0
    // cp1=(0,50) in SVG → transformPoint → (0, 50) in cutout space
    // prev=(0,0) in SVG → transformPoint → (0, 100) in cutout space
    // handleOut.dx = 0-0=0, handleOut.dy = 50-100=-50
    const result = convertPath(makePath('M 0 0 C 0 50 100 50 100 0'), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    const pt0 = result![0].path![0];
    expect(pt0.handleOut).not.toBeNull();
    expect(pt0.handleOut!.dx).toBeCloseTo(0, 5);
    expect(pt0.handleOut!.dy).toBeCloseTo(-50, 5);
  });

  it('Z deduplication: closing a path whose last point coincides with the first shrinks point count', () => {
    // Explicitly place last point at same position as M to trigger dedup in CLOSE_PATH
    const withDup = 'M 0 0 L 10 0 L 5 10 L 0 0 Z';
    const result = convertPath(makePath(withDup), IDENTITY, VIEW_BOX);
    expect(result).not.toBeNull();
    // The duplicate endpoint at (0,0) should be removed; we should have 3 points, not 4
    expect(result![0].path).toHaveLength(3);
  });
});
