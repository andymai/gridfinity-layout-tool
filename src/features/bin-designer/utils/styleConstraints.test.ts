import { describe, it, expect } from 'vitest';
import { getStyleConstraints, isFeatureDisabled } from './styleConstraints';
import type { BinStyle } from '../types';

describe('styleConstraints', () => {
  describe('getStyleConstraints', () => {
    it('standard style has no disabled features', () => {
      const constraints = getStyleConstraints('standard');
      expect(constraints.disabledFeatures).toEqual([]);
      expect(constraints.hasGussets).toBe(false);
    });

    it('slotted style disables dividers and label', () => {
      const constraints = getStyleConstraints('slotted');
      expect(constraints.disabledFeatures).toContain('dividers');
      expect(constraints.disabledFeatures).toContain('label');
      expect(constraints.hasGussets).toBe(false);
    });
  });

  describe('isFeatureDisabled', () => {
    it('returns false for standard style features', () => {
      expect(isFeatureDisabled('standard', 'dividers')).toBe(false);
      expect(isFeatureDisabled('standard', 'label')).toBe(false);
    });

    it('returns true for slotted style dividers and label', () => {
      expect(isFeatureDisabled('slotted', 'dividers')).toBe(true);
      expect(isFeatureDisabled('slotted', 'label')).toBe(true);
    });

    it('covers all style types', () => {
      const styles: BinStyle[] = ['standard', 'slotted'];
      for (const style of styles) {
        expect(() => getStyleConstraints(style)).not.toThrow();
      }
    });
  });
});
