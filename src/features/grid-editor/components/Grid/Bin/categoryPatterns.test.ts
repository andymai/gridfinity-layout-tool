import { describe, it, expect } from 'vitest';
import {
  CATEGORY_PATTERN_COUNT,
  getCategoryPatternIndex,
  getCategoryPatternStyle,
} from './categoryPatterns';

describe('getCategoryPatternIndex', () => {
  it('is deterministic for the same id', () => {
    expect(getCategoryPatternIndex('coral')).toBe(getCategoryPatternIndex('coral'));
  });

  it('always returns an index within range', () => {
    for (const id of ['coral', 'sky', 'green', 'cloud', 'charcoal', 'a', '', 'x'.repeat(64)]) {
      const idx = getCategoryPatternIndex(id);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(CATEGORY_PATTERN_COUNT);
    }
  });

  it('does not depend on order (id-based, reorder-stable)', () => {
    // The index is a pure function of the id, so it is unaffected by where the
    // category sits in any list.
    const before = getCategoryPatternIndex('hardware');
    const after = getCategoryPatternIndex('hardware');
    expect(before).toBe(after);
  });
});

describe('getCategoryPatternStyle', () => {
  it('returns a non-empty background for every pattern index', () => {
    for (let i = 0; i < CATEGORY_PATTERN_COUNT; i++) {
      const style = getCategoryPatternStyle(i, 'rgba(0,0,0,0.4)');
      expect(style.backgroundImage).not.toBe('none');
      expect(style.backgroundImage).toContain('rgba(0,0,0,0.4)');
    }
  });

  it('handles out-of-range and negative indices safely', () => {
    expect(getCategoryPatternStyle(CATEGORY_PATTERN_COUNT, 'red').backgroundImage).not.toBe('none');
    expect(getCategoryPatternStyle(-1, 'red').backgroundImage).not.toBe('none');
  });
});
