import { describe, it, expect } from 'vitest';
import { entryChamferWidth } from './cutoutFit';

describe('entryChamferWidth', () => {
  it('keeps a straight wall under the bevel', () => {
    expect(entryChamferWidth({ shape: 'slot', cutDepth: 10, chamferWidth: 0.8 })).toBe(0.8);
    expect(entryChamferWidth({ shape: 'slot', cutDepth: 0.6, chamferWidth: 0.8 })).toBeCloseTo(
      0.4,
      9
    );
  });

  it('gives none to a shape that takes none', () => {
    expect(entryChamferWidth({ shape: 'text', cutDepth: 10, chamferWidth: 0.8 })).toBe(0);
  });
});
