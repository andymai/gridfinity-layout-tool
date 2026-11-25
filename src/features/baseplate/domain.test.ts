import { describe, expect, it } from 'vitest';
import { splitDefaultBaseplate } from './domain';

describe('splitDefaultBaseplate', () => {
  it('keeps a plate that fits the bed whole, and splits one that does not', () => {
    expect(splitDefaultBaseplate({ width: 5, depth: 5 }, { width: 256, depth: 256 }).isSplit).toBe(
      false
    );
    const split = splitDefaultBaseplate({ width: 10, depth: 8 }, { width: 256, depth: 256 });
    expect(split.isSplit).toBe(true);
    expect(split.pieces.reduce((sum, piece) => sum + piece.widthUnits * piece.depthUnits, 0)).toBe(
      80
    );
  });
});
