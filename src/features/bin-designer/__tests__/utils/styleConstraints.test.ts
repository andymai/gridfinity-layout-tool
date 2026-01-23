import { describe, it, expect } from 'vitest';
import { getStyleConstraints, isFeatureDisabled } from '../../utils/styleConstraints';
import type { BinStyle } from '../../types';

describe('styleConstraints', () => {
  describe('getStyleConstraints', () => {
    it('standard style has no disabled features', () => {
      const constraints = getStyleConstraints('standard');
      expect(constraints.disabledFeatures).toEqual([]);
      expect(constraints.hasGussets).toBe(false);
    });

    it('lite style has no disabled features', () => {
      const constraints = getStyleConstraints('lite');
      expect(constraints.disabledFeatures).toEqual([]);
      expect(constraints.hasGussets).toBe(false);
    });

    it('solid style enables gussets', () => {
      const constraints = getStyleConstraints('solid');
      expect(constraints.disabledFeatures).toEqual([]);
      expect(constraints.hasGussets).toBe(true);
    });

    it('lite has a warning about structural integrity', () => {
      const constraints = getStyleConstraints('lite');
      expect(constraints.warnings.length).toBeGreaterThan(0);
      expect(constraints.warnings[0]).toContain('structural');
    });
  });

  describe('isFeatureDisabled', () => {
    it('returns false for standard style features', () => {
      expect(isFeatureDisabled('standard', 'dividers')).toBe(false);
      expect(isFeatureDisabled('standard', 'scoop')).toBe(false);
      expect(isFeatureDisabled('standard', 'label')).toBe(false);
    });

    it('covers all style types', () => {
      const styles: BinStyle[] = ['standard', 'lite', 'solid'];
      for (const style of styles) {
        // Should not throw for any valid style
        expect(() => getStyleConstraints(style)).not.toThrow();
      }
    });
  });
});
