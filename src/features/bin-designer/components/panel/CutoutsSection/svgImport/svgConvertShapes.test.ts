import { describe, it, expect } from 'vitest';
import type { PathPoint } from '@/features/bin-designer/types';
import { pathPointsToSpec } from './svgConvertShapes';

const pt = (x: number, y: number): PathPoint => ({
  x,
  y,
  handleIn: null,
  handleOut: null,
  symmetric: false,
});

describe('pathPointsToSpec — path data hygiene', () => {
  // SVG <polygon>/<polyline> commonly repeat the first vertex to close the
  // shape; that trailing duplicate is a zero-length edge. Strip it at import
  // so stored path data is canonical (not just deduped at render time).
  it('drops a trailing vertex coincident with the first', () => {
    const spec = pathPointsToSpec([pt(0, 0), pt(10, 0), pt(5, 10), pt(0, 0)]);
    expect(spec?.path?.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 0],
      [5, 10],
    ]);
  });

  it('drops duplicate consecutive vertices', () => {
    const spec = pathPointsToSpec([pt(0, 0), pt(10, 0), pt(10, 0), pt(5, 10)]);
    expect(spec?.path?.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [10, 0],
      [5, 10],
    ]);
  });

  it('leaves a clean polygon untouched', () => {
    const spec = pathPointsToSpec([pt(0, 0), pt(10, 0), pt(5, 10)]);
    expect(spec?.path).toHaveLength(3);
  });
});
