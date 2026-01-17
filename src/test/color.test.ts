import { describe, it, expect } from 'vitest';
import { getContrastColor } from '../shared/utils';

describe('getContrastColor', () => {
  describe('light backgrounds should return dark text', () => {
    it('returns dark text for white', () => {
      expect(getContrastColor('#ffffff')).toBe('var(--text-on-light)');
    });

    it('returns dark text for light gray', () => {
      expect(getContrastColor('#cccccc')).toBe('var(--text-on-light)');
    });

    it('returns dark text for light yellow', () => {
      expect(getContrastColor('#ffff00')).toBe('var(--text-on-light)');
    });

    it('returns dark text for light cyan', () => {
      expect(getContrastColor('#00ffff')).toBe('var(--text-on-light)');
    });
  });

  describe('dark backgrounds should return light text', () => {
    it('returns light text for black', () => {
      expect(getContrastColor('#000000')).toBe('var(--text-on-dark)');
    });

    it('returns light text for dark gray', () => {
      expect(getContrastColor('#333333')).toBe('var(--text-on-dark)');
    });

    it('returns light text for dark blue', () => {
      expect(getContrastColor('#000080')).toBe('var(--text-on-dark)');
    });

    it('returns light text for dark red', () => {
      expect(getContrastColor('#800000')).toBe('var(--text-on-dark)');
    });
  });

  describe('edge cases', () => {
    it('handles hex without # prefix', () => {
      expect(getContrastColor('ffffff')).toBe('var(--text-on-light)');
      expect(getContrastColor('000000')).toBe('var(--text-on-dark)');
    });

    it('handles mid-gray (boundary case)', () => {
      // RGB 128,128,128 has luminance ~0.502 (slightly above 0.5)
      // Luminance = (0.299*128 + 0.587*128 + 0.114*128) / 255 ≈ 0.502
      const result = getContrastColor('#808080');
      // Since luminance > 0.5, it returns dark text for light background
      expect(result).toBe('var(--text-on-light)');
    });

    it('handles primary colors', () => {
      // Pure red: luminance = 0.299 * 255 / 255 = 0.299 (dark)
      expect(getContrastColor('#ff0000')).toBe('var(--text-on-dark)');
      // Pure green: luminance = 0.587 * 255 / 255 = 0.587 (light)
      expect(getContrastColor('#00ff00')).toBe('var(--text-on-light)');
      // Pure blue: luminance = 0.114 * 255 / 255 = 0.114 (dark)
      expect(getContrastColor('#0000ff')).toBe('var(--text-on-dark)');
    });
  });
});
