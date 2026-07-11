import { describe, it, expect } from 'vitest';
import { hasFractionalEdgeMismatch, computeMatchedEdges } from './fractionalEdge';

describe('hasFractionalEdgeMismatch', () => {
  it('flags a fractional-width design whose edge disagrees with the drawer', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'end', fractionalEdgeManual: false },
        { fractionalEdgeX: 'start' }
      )
    ).toBe(true);
  });

  it('flags a fractional-depth mismatch independently of width', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 2, depth: 2.5, fractionalEdgeY: 'end' },
        { fractionalEdgeY: 'start' }
      )
    ).toBe(true);
  });

  it('does not flag when the edges agree', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'start' },
        { fractionalEdgeX: 'start' }
      )
    ).toBe(false);
  });

  it('treats an unset drawer edge as the default end edge', () => {
    expect(hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'end' }, {})).toBe(
      false
    );
    expect(hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'start' }, {})).toBe(
      true
    );
  });

  it('never flags an integer dimension', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 2, depth: 2, fractionalEdgeX: 'end' },
        { fractionalEdgeX: 'start' }
      )
    ).toBe(false);
  });

  it('suppresses the warning once the edge is manual', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'end', fractionalEdgeManual: true },
        { fractionalEdgeX: 'start' }
      )
    ).toBe(false);
  });

  it('does not flag when the design edge is unknown (legacy registry entry)', () => {
    expect(hasFractionalEdgeMismatch({ width: 1.5, depth: 2 }, { fractionalEdgeX: 'start' })).toBe(
      false
    );
  });
});

describe('computeMatchedEdges', () => {
  it('aligns only the fractional axes to the drawer and clears the manual flag', () => {
    expect(
      computeMatchedEdges(
        { width: 1.5, depth: 2, fractionalEdgeX: 'end', fractionalEdgeManual: true },
        { fractionalEdgeX: 'start', fractionalEdgeY: 'start' }
      )
    ).toEqual({ fractionalEdgeX: 'start', fractionalEdgeManual: false });
  });

  it('aligns both axes when both dimensions are fractional', () => {
    expect(
      computeMatchedEdges(
        { width: 1.5, depth: 2.5 },
        { fractionalEdgeX: 'start', fractionalEdgeY: 'end' }
      )
    ).toEqual({ fractionalEdgeX: 'start', fractionalEdgeY: 'end', fractionalEdgeManual: false });
  });

  it('defaults an unset drawer edge to end', () => {
    expect(computeMatchedEdges({ width: 1.5, depth: 2 }, {})).toEqual({
      fractionalEdgeX: 'end',
      fractionalEdgeManual: false,
    });
  });
});
