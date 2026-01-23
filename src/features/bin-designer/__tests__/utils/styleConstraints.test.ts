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

    it('vase style disables all interior features', () => {
      const constraints = getStyleConstraints('vase');
      expect(constraints.disabledFeatures).toContain('dividers');
      expect(constraints.disabledFeatures).toContain('scoop');
      expect(constraints.disabledFeatures).toContain('label');
      expect(constraints.disabledFeatures).toContain('walls');
      expect(constraints.hasGussets).toBe(false);
    });

    it('rugged style enables gussets', () => {
      const constraints = getStyleConstraints('rugged');
      expect(constraints.disabledFeatures).toEqual([]);
      expect(constraints.hasGussets).toBe(true);
    });

    it('vase has a warning message', () => {
      const constraints = getStyleConstraints('vase');
      expect(constraints.warnings.length).toBeGreaterThan(0);
      expect(constraints.warnings[0]).toContain('Vase');
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

    it('returns true for vase mode interior features', () => {
      expect(isFeatureDisabled('vase', 'dividers')).toBe(true);
      expect(isFeatureDisabled('vase', 'scoop')).toBe(true);
      expect(isFeatureDisabled('vase', 'label')).toBe(true);
      expect(isFeatureDisabled('vase', 'walls')).toBe(true);
    });

    it('returns false for rugged style features', () => {
      expect(isFeatureDisabled('rugged', 'dividers')).toBe(false);
      expect(isFeatureDisabled('rugged', 'scoop')).toBe(false);
    });

    it('covers all style types', () => {
      const styles: BinStyle[] = ['standard', 'lite', 'solid', 'vase', 'rugged'];
      for (const style of styles) {
        // Should not throw for any valid style
        expect(() => getStyleConstraints(style)).not.toThrow();
      }
    });
  });
});
