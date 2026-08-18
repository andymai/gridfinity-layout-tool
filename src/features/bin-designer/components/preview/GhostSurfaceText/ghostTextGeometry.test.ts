import { describe, it, expect } from 'vitest';
import { contourSegments } from './ghostTextGeometry';

describe('contourSegments', () => {
  it('closes the loop, because a glyph outline with a gap misrepresents the print', () => {
    // A triangle: three points, three edges. Walking the points alone yields
    // two, which is the bug this exists to prevent.
    const segments = contourSegments([0, 0, 1, 0, 1, 1]);
    expect(segments).toEqual([0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 0]);
  });

  it('does not add a zero-length edge when the contour already returns to its start', () => {
    const segments = contourSegments([0, 0, 1, 0, 0, 0]);
    expect(segments).toEqual([0, 0, 1, 0, 1, 0, 0, 0]);
  });

  it('emits nothing for a degenerate contour', () => {
    expect(contourSegments([])).toEqual([]);
    expect(contourSegments([1, 2])).toEqual([]);
  });
});
