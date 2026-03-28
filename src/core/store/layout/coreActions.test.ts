import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutStore } from '@/core/store/layout';
import { CONSTRAINTS } from '@/core/constants';
import type { Mm, GridUnits } from '@/core/types';
import { layoutId } from '@/core/types';
import { resetAllStores, createTestLayout } from '@/test/testUtils';

describe('coreActions', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('importLayout', () => {
    it('replaces the layout', () => {
      const newLayout = createTestLayout({ name: 'Imported' });
      useLayoutStore.getState().importLayout(newLayout);
      expect(useLayoutStore.getState().layout.name).toBe('Imported');
    });

    it('sets activeLayoutId when provided', () => {
      const lid = layoutId('imported-1');
      useLayoutStore.getState().importLayout(createTestLayout(), lid);
      expect(useLayoutStore.getState().activeLayoutId).toBe(lid);
    });

    it('sets activeLayoutId to null when not provided', () => {
      useLayoutStore.getState().importLayout(createTestLayout());
      expect(useLayoutStore.getState().activeLayoutId).toBeNull();
    });

    it('sets lastEditSource', () => {
      useLayoutStore.getState().importLayout(createTestLayout(), undefined, 'remote');
      expect(useLayoutStore.getState().lastEditSource).toBe('remote');
    });

    it('defaults editSource to local', () => {
      useLayoutStore.getState().importLayout(createTestLayout());
      expect(useLayoutStore.getState().lastEditSource).toBe('local');
    });
  });

  describe('setActiveLayoutId', () => {
    it('sets the active layout id', () => {
      const lid = layoutId('my-layout');
      useLayoutStore.getState().setActiveLayoutId(lid);
      expect(useLayoutStore.getState().activeLayoutId).toBe(lid);
    });

    it('can set to null', () => {
      useLayoutStore.getState().setActiveLayoutId(layoutId('x'));
      useLayoutStore.getState().setActiveLayoutId(null);
      expect(useLayoutStore.getState().activeLayoutId).toBeNull();
    });
  });

  describe('setName', () => {
    it('sets the layout name', () => {
      useLayoutStore.getState().setName('My Layout');
      expect(useLayoutStore.getState().layout.name).toBe('My Layout');
    });

    it('truncates name at NAME_MAX_LENGTH', () => {
      const longName = 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 20);
      useLayoutStore.getState().setName(longName);
      expect(useLayoutStore.getState().layout.name).toHaveLength(CONSTRAINTS.NAME_MAX_LENGTH);
    });

    it('handles empty name', () => {
      useLayoutStore.getState().setName('');
      expect(useLayoutStore.getState().layout.name).toBe('');
    });
  });

  describe('setPrintBedSize', () => {
    it('sets print bed size', () => {
      useLayoutStore.getState().setPrintBedSize(300);
      expect(useLayoutStore.getState().layout.printBedSize).toBe(300);
    });

    it('clamps to minimum 42', () => {
      useLayoutStore.getState().setPrintBedSize(1);
      expect(useLayoutStore.getState().layout.printBedSize).toBe(42);
    });

    it('clamps to maximum 500', () => {
      useLayoutStore.getState().setPrintBedSize(9999);
      expect(useLayoutStore.getState().layout.printBedSize).toBe(500);
    });
  });

  describe('setGridUnitMm', () => {
    it('sets grid unit mm', () => {
      useLayoutStore.getState().setGridUnitMm(50);
      expect(useLayoutStore.getState().layout.gridUnitMm).toBe(50);
    });

    it('clamps to min 1', () => {
      useLayoutStore.getState().setGridUnitMm(0);
      expect(useLayoutStore.getState().layout.gridUnitMm).toBe(1);
    });

    it('clamps to max 200', () => {
      useLayoutStore.getState().setGridUnitMm(999);
      expect(useLayoutStore.getState().layout.gridUnitMm).toBe(200);
    });
  });

  describe('setHeightUnitMm', () => {
    it('sets height unit mm', () => {
      useLayoutStore.getState().setHeightUnitMm(14);
      expect(useLayoutStore.getState().layout.heightUnitMm).toBe(14);
    });

    it('clamps to min 1', () => {
      useLayoutStore.getState().setHeightUnitMm(-5);
      expect(useLayoutStore.getState().layout.heightUnitMm).toBe(1);
    });

    it('clamps to max 50', () => {
      useLayoutStore.getState().setHeightUnitMm(100);
      expect(useLayoutStore.getState().layout.heightUnitMm).toBe(50);
    });
  });

  describe('setBaseplateParams', () => {
    it('sets baseplate params with clamping', () => {
      useLayoutStore.getState().setBaseplateParams({
        paddingLeft: -5 as Mm,
        paddingRight: 10 as Mm,
        paddingFront: 5 as Mm,
        paddingBack: 3 as Mm,
        magnetDiameter: 6.0 as Mm,
        magnetDepth: 2.0 as Mm,
      });
      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(params?.paddingLeft).toBe(0); // clamped to 0
      expect(params?.paddingRight).toBe(10);
      expect(params?.magnetDiameter).toBe(6.0);
    });

    it('clamps magnet dimensions', () => {
      useLayoutStore.getState().setBaseplateParams({
        paddingLeft: 0 as Mm,
        paddingRight: 0 as Mm,
        paddingFront: 0 as Mm,
        paddingBack: 0 as Mm,
        magnetDiameter: 0.1 as Mm, // below min 0.5
        magnetDepth: 99 as Mm, // above max 10
      });
      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(params?.magnetDiameter).toBe(0.5);
      expect(params?.magnetDepth).toBe(10);
    });

    it('clamps baseplate width and depth', () => {
      useLayoutStore.getState().setBaseplateParams({
        paddingLeft: 0 as Mm,
        paddingRight: 0 as Mm,
        paddingFront: 0 as Mm,
        paddingBack: 0 as Mm,
        magnetDiameter: 6 as Mm,
        magnetDepth: 2 as Mm,
        baseplateWidth: 0.1 as GridUnits, // below min 0.5
        baseplateDepth: 999 as GridUnits, // above max 50
      });
      const params = useLayoutStore.getState().layout.baseplateParams;
      expect(params?.baseplateWidth).toBe(0.5);
      expect(params?.baseplateDepth).toBe(50);
    });
  });

  describe('restoreLayout', () => {
    it('replaces layout and sets source to local', () => {
      const restored = createTestLayout({ name: 'Restored' });
      useLayoutStore.getState().restoreLayout(restored);
      expect(useLayoutStore.getState().layout.name).toBe('Restored');
      expect(useLayoutStore.getState().lastEditSource).toBe('local');
    });
  });
});
