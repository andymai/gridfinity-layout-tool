import { describe, it, expect } from 'vitest';
import { normalizeTags, MAX_TAGS, MAX_TAG_LENGTH } from './tags';

describe('normalizeTags', () => {
  it('trims, drops empties, and dedupes case-insensitively keeping first casing', () => {
    expect(normalizeTags([' Kitchen ', 'kitchen', '', '  '])).toEqual(['Kitchen']);
  });

  it('caps tag length', () => {
    const long = 'x'.repeat(MAX_TAG_LENGTH + 5);
    expect(normalizeTags([long])).toEqual(['x'.repeat(MAX_TAG_LENGTH)]);
  });

  it(`caps total count at ${MAX_TAGS}`, () => {
    const many = Array.from({ length: MAX_TAGS + 3 }, (_, i) => `t${i}`);
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS);
  });

  it('returns [] for non-array or junk input', () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
    expect(normalizeTags([1, null, {}] as unknown)).toEqual([]);
  });

  it('preserves order of first appearance', () => {
    expect(normalizeTags(['b', 'a', 'B', 'c'])).toEqual(['b', 'a', 'c']);
  });
});
