import { describe, it, expect } from 'vitest';
import { getPrintTextColors } from './printBinLayout';

describe('printBinLayout', () => {
  describe('getPrintTextColors', () => {
    it('returns dark text for light backgrounds', () => {
      const colors = getPrintTextColors('#ffffff');
      expect(colors.primary).toContain('0, 0, 0');
    });

    it('returns light text for dark backgrounds', () => {
      const colors = getPrintTextColors('#000000');
      expect(colors.primary).toContain('255, 255, 255');
    });

    it('returns dark text for yellow (high luminance)', () => {
      const colors = getPrintTextColors('#ffff00');
      expect(colors.primary).toContain('0, 0, 0');
    });

    it('returns light text for dark blue', () => {
      const colors = getPrintTextColors('#000066');
      expect(colors.primary).toContain('255, 255, 255');
    });

    it('handles colors with # prefix', () => {
      expect(() => getPrintTextColors('#ff0000')).not.toThrow();
    });

    it('handles colors without # prefix', () => {
      const colors = getPrintTextColors('334155'); // charcoal without #
      expect(colors.primary).toContain('255, 255, 255'); // dark color → light text
    });

    it('returns both primary and secondary colors', () => {
      const colors = getPrintTextColors('#ffffff');
      expect(colors.primary).toBeDefined();
      expect(colors.secondary).toBeDefined();
      expect(colors.primary).not.toBe(colors.secondary);
    });
  });
});
