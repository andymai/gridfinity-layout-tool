import { describe, it, expect } from 'vitest';
import { nextEdgeFade } from './edgeFade';

describe('nextEdgeFade', () => {
  it('fades in when edges first appear from nothing', () => {
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: true, prevIsDraft: false, isDraft: false })
    ).toBe('appear');
  });

  it('gently fades on the draft→final finalize', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: true, prevIsDraft: true, isDraft: false })
    ).toBe('finalize');
  });

  it('does nothing on a draft→draft update (edges already present)', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: true, prevIsDraft: true, isDraft: true })
    ).toBe(null);
  });

  it('does nothing when edges are unchanged on the final', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: true, prevIsDraft: false, isDraft: false })
    ).toBe(null);
  });

  it('does nothing when there are no edges', () => {
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: false, prevIsDraft: true, isDraft: false })
    ).toBe(null);
  });

  it('returns appear (not finalize) when edges first appear on the finalize transition', () => {
    // prevIsDraft was true, but there were no edges yet — first-appearance wins
    // over the finalize branch, so this fades in from 0 rather than the floor.
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: true, prevIsDraft: true, isDraft: false })
    ).toBe('appear');
  });

  it('fades appear on the first draft tick of a new generation', () => {
    expect(
      nextEdgeFade({ prevHadEdges: false, hasEdges: true, prevIsDraft: false, isDraft: true })
    ).toBe('appear');
  });

  it('does nothing when edges disappear (mesh cleared)', () => {
    expect(
      nextEdgeFade({ prevHadEdges: true, hasEdges: false, prevIsDraft: false, isDraft: false })
    ).toBe(null);
  });
});
