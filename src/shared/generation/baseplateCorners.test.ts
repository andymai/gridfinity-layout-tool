import { describe, it, expect } from 'vitest';
import { exteriorCorners } from './baseplateCorners';

describe('exteriorCorners', () => {
  it('treats an unsplit plate (no edges) as all-exterior', () => {
    expect(exteriorCorners(undefined)).toEqual({ tl: true, tr: true, bl: true, br: true });
  });

  it('marks a corner exterior only when both adjacent edges are exterior', () => {
    // Top-left interior piece: every edge a join seam → no exterior corner.
    expect(exteriorCorners({ left: 'join', right: 'join', front: 'join', back: 'join' })).toEqual({
      tl: false,
      tr: false,
      bl: false,
      br: false,
    });

    // A true bottom-left corner piece: left + front exterior → only bl rounds.
    expect(
      exteriorCorners({ left: 'exterior', right: 'join', front: 'exterior', back: 'join' })
    ).toEqual({ tl: false, tr: false, bl: true, br: false });

    // Top edge piece: only the back edge is exterior → no two-exterior corner.
    expect(
      exteriorCorners({ left: 'join', right: 'join', front: 'join', back: 'exterior' })
    ).toEqual({ tl: false, tr: false, bl: false, br: false });
  });
});
