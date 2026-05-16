import { describe, it, expect } from 'vitest';
import { suggestMatchingColors } from './colorSuggestions';

describe('suggestMatchingColors', () => {
  it('returns an empty array for invalid hex input', () => {
    expect(suggestMatchingColors('not a hex')).toEqual([]);
    expect(suggestMatchingColors('#zzz')).toEqual([]);
  });

  it('falls back to a curated accent set for near-grey input', () => {
    const result = suggestMatchingColors('#d4d8dc');
    expect(result).toHaveLength(5);
    // The curated set is non-grey so the user sees usable accents
    for (const hex of result) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('returns five harmonized colors for a saturated input', () => {
    const result = suggestMatchingColors('#3b82f6');
    expect(result).toHaveLength(5);
    for (const hex of result) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      // None should equal the input (analogous/complementary/triadic — all rotate hue)
      expect(hex.toLowerCase()).not.toBe('#3b82f6');
    }
  });

  it('produces distinct hexes for a vivid input', () => {
    const result = suggestMatchingColors('#ef4444');
    const unique = new Set(result.map((c) => c.toLowerCase()));
    expect(unique.size).toBe(5);
  });
});
