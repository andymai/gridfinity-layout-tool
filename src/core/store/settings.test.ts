import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useSettingsStore,
  DEFAULT_SETTINGS,
  DEFAULT_PRINT_VIEW_SETTINGS,
  DEFAULT_BIN_LIST_SORT_ORDER,
  normalizeSortOrder,
  DEFAULT_STL_SEARCH_SITES,
  STL_SEARCH_CONSTRAINTS,
} from '@/core/store/settings';
import type { BinListSortOrder, STLSearchSite } from '@/core/store/settings';
import { resetAllStores, createIsolatedLocalStorageMock } from '@/test/testUtils';

describe('settings store', () => {
  let localStorageMock: ReturnType<typeof createIsolatedLocalStorageMock>;

  beforeEach(() => {
    // Create isolated localStorage mock per test
    localStorageMock = createIsolatedLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock.mock,
      writable: true,
      configurable: true,
    });

    // Reset all stores for isolation
    resetAllStores();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.cleanup();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('has default settings', () => {
      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(10);
      expect(settings.defaultDrawerDepth).toBe(8);
      expect(settings.defaultDrawerHeight).toBe(12);
      expect(settings.defaultLayerHeight).toBe(3);
      expect(settings.defaultPrintBedSize).toBe(256);
      expect(settings.defaultGridUnitMm).toBe(42);
      expect(settings.defaultHeightUnitMm).toBe(7);
      expect(settings.defaultZoom).toBe(1.0);
    });
  });

  describe('updateSetting', () => {
    it('updates a single setting', () => {
      const { updateSetting } = useSettingsStore.getState();
      updateSetting('defaultDrawerWidth', 15);

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(15);
    });

    it('persists to localStorage', () => {
      const { updateSetting } = useSettingsStore.getState();
      updateSetting('defaultDrawerWidth', 15);

      expect(localStorageMock.mock.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorageMock.mock._store['gridfinity-settings-v1']);
      expect(savedData.defaultDrawerWidth).toBe(15);
    });

    it('preserves other settings when updating one', () => {
      const { updateSetting } = useSettingsStore.getState();
      updateSetting('defaultDrawerWidth', 15);

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerDepth).toBe(8);
      expect(settings.defaultPrintBedSize).toBe(256);
    });

    it('updates default layer height', () => {
      const { updateSetting } = useSettingsStore.getState();
      updateSetting('defaultLayerHeight', 5);

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultLayerHeight).toBe(5);
    });
  });

  describe('updateSettings', () => {
    it('updates multiple settings at once', () => {
      const { updateSettings } = useSettingsStore.getState();
      updateSettings({
        defaultDrawerWidth: 20,
        defaultDrawerDepth: 15,
        defaultPrintBedSize: 300,
      });

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(20);
      expect(settings.defaultDrawerDepth).toBe(15);
      expect(settings.defaultPrintBedSize).toBe(300);
    });

    it('persists all updates to localStorage', () => {
      const { updateSettings } = useSettingsStore.getState();
      updateSettings({
        defaultDrawerWidth: 20,
        defaultDrawerDepth: 15,
      });

      const savedData = JSON.parse(localStorageMock.mock._store['gridfinity-settings-v1']);
      expect(savedData.defaultDrawerWidth).toBe(20);
      expect(savedData.defaultDrawerDepth).toBe(15);
    });
  });

  describe('resetSettings', () => {
    it('resets all settings to defaults', () => {
      const { updateSettings, resetSettings } = useSettingsStore.getState();

      // Change some settings
      updateSettings({
        defaultDrawerWidth: 50,
        defaultPrintBedSize: 400,
      });

      // Reset
      resetSettings();

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(10);
      expect(settings.defaultPrintBedSize).toBe(256);
    });

    it('persists reset to localStorage', () => {
      const { updateSettings, resetSettings } = useSettingsStore.getState();

      updateSettings({ defaultDrawerWidth: 50 });
      resetSettings();

      const savedData = JSON.parse(localStorageMock.mock._store['gridfinity-settings-v1']);
      expect(savedData.defaultDrawerWidth).toBe(10);
    });
  });

  describe('saveCurrentAsDefaults', () => {
    it('saves drawer dimensions and settings', () => {
      const { saveCurrentAsDefaults } = useSettingsStore.getState();

      saveCurrentAsDefaults({ width: 25, depth: 20, height: 15 }, 300, 50, 10, 5);

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(25);
      expect(settings.defaultDrawerDepth).toBe(20);
      expect(settings.defaultDrawerHeight).toBe(15);
      expect(settings.defaultLayerHeight).toBe(5);
      expect(settings.defaultPrintBedSize).toBe(300);
      expect(settings.defaultGridUnitMm).toBe(50);
      expect(settings.defaultHeightUnitMm).toBe(10);
    });

    it('preserves non-layout settings', () => {
      const { updateSetting, saveCurrentAsDefaults } = useSettingsStore.getState();

      // Set a non-layout setting
      updateSetting('defaultZoom', 1.5);

      // Save layout defaults
      saveCurrentAsDefaults({ width: 25, depth: 20, height: 15 }, 300, 50, 10, 5);

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultZoom).toBe(1.5);
    });

    it('persists to localStorage', () => {
      const { saveCurrentAsDefaults } = useSettingsStore.getState();

      saveCurrentAsDefaults({ width: 25, depth: 20, height: 15 }, 300, 50, 10, 5);

      const savedData = JSON.parse(localStorageMock.mock._store['gridfinity-settings-v1']);
      expect(savedData.defaultDrawerWidth).toBe(25);
      expect(savedData.defaultLayerHeight).toBe(5);
      expect(savedData.defaultPrintBedSize).toBe(300);
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('matches createDefaultLayout values', () => {
      // These should match the values in createDefaultLayout in constants.ts
      expect(DEFAULT_SETTINGS.defaultDrawerWidth).toBe(10);
      expect(DEFAULT_SETTINGS.defaultDrawerDepth).toBe(8);
      expect(DEFAULT_SETTINGS.defaultDrawerHeight).toBe(12);
      expect(DEFAULT_SETTINGS.defaultLayerHeight).toBe(3);
      expect(DEFAULT_SETTINGS.defaultPrintBedSize).toBe(256);
      expect(DEFAULT_SETTINGS.defaultGridUnitMm).toBe(42);
      expect(DEFAULT_SETTINGS.defaultHeightUnitMm).toBe(7);
    });
  });

  describe('error handling', () => {
    it('handles save errors gracefully', () => {
      // Make setItem throw
      localStorageMock.mock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Try to update a setting
      const { updateSetting } = useSettingsStore.getState();
      expect(() => updateSetting('defaultDrawerWidth', 20)).not.toThrow();

      // State should still be updated even if save failed
      expect(useSettingsStore.getState().settings.defaultDrawerWidth).toBe(20);
      expect(warnSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error));
      warnSpy.mockRestore();
    });

    it('handles resetSettings save errors gracefully', () => {
      // Make setItem throw
      localStorageMock.mock.setItem = vi.fn(() => {
        throw new Error('QuotaExceededError');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Try to reset settings
      const { resetSettings } = useSettingsStore.getState();
      expect(() => resetSettings()).not.toThrow();

      // State should still be reset
      expect(useSettingsStore.getState().settings.defaultDrawerWidth).toBe(
        DEFAULT_SETTINGS.defaultDrawerWidth
      );
      expect(warnSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error));
      warnSpy.mockRestore();
    });
  });

  describe('printViewSettings', () => {
    it('has default print view settings', () => {
      const settings = useSettingsStore.getState().settings;
      expect(settings.printViewSettings).toBeDefined();
      expect(settings.printViewSettings.showLabel).toBe(true);
      expect(settings.printViewSettings.showCategoryColor).toBe(true);
      expect(settings.printViewSettings.showBinList).toBe(false);
    });

    it('has default bin list sort order', () => {
      const settings = useSettingsStore.getState().settings;
      const sortOrder = settings.printViewSettings.binListSortOrder;
      expect(sortOrder).toBeDefined();
      expect(sortOrder.length).toBeGreaterThan(0);
      // Category and position should be enabled by default
      expect(sortOrder.find((s) => s.field === 'category')?.enabled).toBe(true);
      expect(sortOrder.find((s) => s.field === 'position')?.enabled).toBe(true);
    });

    it('updates print view setting', () => {
      const { updateSetting } = useSettingsStore.getState();
      const currentSettings = useSettingsStore.getState().settings.printViewSettings;

      updateSetting('printViewSettings', {
        ...currentSettings,
        showLabel: false,
      });

      expect(useSettingsStore.getState().settings.printViewSettings.showLabel).toBe(false);
    });

    it('updates sort order', () => {
      const { updateSetting } = useSettingsStore.getState();
      const currentSettings = useSettingsStore.getState().settings.printViewSettings;

      const newSortOrder = currentSettings.binListSortOrder.map((s) =>
        s.field === 'size' ? { ...s, enabled: true } : s
      );

      updateSetting('printViewSettings', {
        ...currentSettings,
        binListSortOrder: newSortOrder,
      });

      const sortOrder = useSettingsStore.getState().settings.printViewSettings.binListSortOrder;
      expect(sortOrder.find((s) => s.field === 'size')?.enabled).toBe(true);
    });
  });

  describe('DEFAULT_PRINT_VIEW_SETTINGS', () => {
    it('has all bin display options', () => {
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showLabel).toBe(true);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showCategoryColor).toBe(true);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showSize).toBe(true);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showHeight).toBe(true);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showNotes).toBe(true);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showCustomProperties).toBe(true);
    });

    it('has all layout options', () => {
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showGridCoordinates).toBe(true);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showLegend).toBe(false);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showBinList).toBe(false);
      expect(DEFAULT_PRINT_VIEW_SETTINGS.showDate).toBe(true);
    });

    it('has bin list sort order', () => {
      expect(DEFAULT_PRINT_VIEW_SETTINGS.binListSortOrder).toBeDefined();
      expect(DEFAULT_PRINT_VIEW_SETTINGS.binListSortOrder.length).toBe(6);
    });
  });

  describe('DEFAULT_BIN_LIST_SORT_ORDER', () => {
    it('has all sort fields', () => {
      const fields = DEFAULT_BIN_LIST_SORT_ORDER.map((s) => s.field);
      expect(fields).toContain('category');
      expect(fields).toContain('layer');
      expect(fields).toContain('position');
      expect(fields).toContain('size');
      expect(fields).toContain('height');
      expect(fields).toContain('label');
    });

    it('has category and position enabled by default', () => {
      expect(DEFAULT_BIN_LIST_SORT_ORDER.find((s) => s.field === 'category')?.enabled).toBe(true);
      expect(DEFAULT_BIN_LIST_SORT_ORDER.find((s) => s.field === 'position')?.enabled).toBe(true);
    });

    it('has other fields disabled by default', () => {
      expect(DEFAULT_BIN_LIST_SORT_ORDER.find((s) => s.field === 'layer')?.enabled).toBe(false);
      expect(DEFAULT_BIN_LIST_SORT_ORDER.find((s) => s.field === 'size')?.enabled).toBe(false);
      expect(DEFAULT_BIN_LIST_SORT_ORDER.find((s) => s.field === 'height')?.enabled).toBe(false);
      expect(DEFAULT_BIN_LIST_SORT_ORDER.find((s) => s.field === 'label')?.enabled).toBe(false);
    });
  });

  describe('normalizeSortOrder', () => {
    it('returns default order when stored is undefined', () => {
      const result = normalizeSortOrder(undefined);
      expect(result).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
    });

    it('returns default order when stored is not an array', () => {
      // @ts-expect-error - testing invalid input
      const result = normalizeSortOrder('not an array');
      expect(result).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
    });

    it('returns default order when stored is null', () => {
      // @ts-expect-error - testing null input
      const result = normalizeSortOrder(null);
      expect(result).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
    });

    it('preserves stored order when all fields present', () => {
      const stored: BinListSortOrder = [
        { field: 'label', enabled: true },
        { field: 'category', enabled: false },
        { field: 'position', enabled: true },
        { field: 'size', enabled: false },
        { field: 'height', enabled: true },
        { field: 'layer', enabled: false },
      ];
      const result = normalizeSortOrder(stored);
      expect(result).toEqual(stored);
    });

    it('adds missing fields at the end (disabled)', () => {
      // Old stored data missing 'size' and 'height' fields
      const stored: BinListSortOrder = [
        { field: 'category', enabled: true },
        { field: 'position', enabled: true },
        { field: 'layer', enabled: false },
        { field: 'label', enabled: false },
      ];
      const result = normalizeSortOrder(stored);

      // Original 4 fields in order
      expect(result[0]).toEqual({ field: 'category', enabled: true });
      expect(result[1]).toEqual({ field: 'position', enabled: true });
      expect(result[2]).toEqual({ field: 'layer', enabled: false });
      expect(result[3]).toEqual({ field: 'label', enabled: false });

      // Missing fields added at end, disabled
      const addedFields = result.slice(4);
      expect(addedFields.length).toBe(2);
      expect(addedFields.every((f) => f.enabled === false)).toBe(true);
      expect(addedFields.map((f) => f.field).sort()).toEqual(['height', 'size']);
    });

    it('removes invalid fields', () => {
      const stored: BinListSortOrder = [
        { field: 'category', enabled: true },
        // @ts-expect-error - testing invalid field
        { field: 'invalid_field', enabled: true },
        { field: 'position', enabled: true },
      ];
      const result = normalizeSortOrder(stored);

      // Invalid field should be removed
      expect(result.find((s) => s.field === ('invalid_field' as string))).toBeUndefined();

      // Valid fields preserved
      expect(result.find((s) => s.field === 'category')?.enabled).toBe(true);
      expect(result.find((s) => s.field === 'position')?.enabled).toBe(true);
    });

    it('handles empty array', () => {
      const result = normalizeSortOrder([]);
      expect(result.length).toBe(6);
      // All fields added (disabled by default from DEFAULT_BIN_LIST_SORT_ORDER)
      expect(result.map((s) => s.field).sort()).toEqual(
        DEFAULT_BIN_LIST_SORT_ORDER.map((s) => s.field).sort()
      );
    });

    it('preserves enabled state from stored data', () => {
      const stored: BinListSortOrder = [
        { field: 'size', enabled: true }, // Originally disabled
        { field: 'category', enabled: false }, // Originally enabled
        { field: 'position', enabled: true },
        { field: 'layer', enabled: true }, // Originally disabled
        { field: 'height', enabled: false },
        { field: 'label', enabled: true }, // Originally disabled
      ];
      const result = normalizeSortOrder(stored);

      expect(result.find((s) => s.field === 'size')?.enabled).toBe(true);
      expect(result.find((s) => s.field === 'category')?.enabled).toBe(false);
      expect(result.find((s) => s.field === 'layer')?.enabled).toBe(true);
      expect(result.find((s) => s.field === 'label')?.enabled).toBe(true);
    });
  });

  describe('STL search sites', () => {
    it('has default STL search sites', () => {
      const settings = useSettingsStore.getState().settings;
      expect(settings.stlSearchSites).toBeDefined();
      expect(settings.stlSearchSites.length).toBeGreaterThan(0);
    });

    it('can update STL search sites', () => {
      const { updateSetting } = useSettingsStore.getState();
      const newSites: STLSearchSite[] = [
        {
          id: 'custom-site',
          name: 'Custom Site',
          urlTemplate: 'https://example.com/search?q={width}x{depth}',
          enabled: true,
        },
      ];

      updateSetting('stlSearchSites', newSites);

      const settings = useSettingsStore.getState().settings;
      expect(settings.stlSearchSites).toEqual(newSites);
    });

    it('persists STL search sites to localStorage', () => {
      const { updateSetting } = useSettingsStore.getState();
      const newSites: STLSearchSite[] = [
        {
          id: 'custom',
          name: 'Custom',
          urlTemplate: 'https://example.com/{width}x{depth}',
          enabled: true,
        },
      ];

      updateSetting('stlSearchSites', newSites);

      const savedData = JSON.parse(localStorageMock.mock._store['gridfinity-settings-v1']);
      expect(savedData.stlSearchSites).toEqual(newSites);
    });
  });

  describe('DEFAULT_STL_SEARCH_SITES', () => {
    it('includes Printables', () => {
      const printables = DEFAULT_STL_SEARCH_SITES.find((s) => s.id === 'printables');
      expect(printables).toBeDefined();
      expect(printables?.enabled).toBe(true);
      expect(printables?.isDefault).toBe(true);
    });

    it('includes MakerWorld', () => {
      const makerworld = DEFAULT_STL_SEARCH_SITES.find((s) => s.id === 'makerworld');
      expect(makerworld).toBeDefined();
      expect(makerworld?.enabled).toBe(true);
      expect(makerworld?.isDefault).toBe(true);
    });

    it('includes Thangs (disabled by default)', () => {
      const thangs = DEFAULT_STL_SEARCH_SITES.find((s) => s.id === 'thangs');
      expect(thangs).toBeDefined();
      expect(thangs?.enabled).toBe(false);
      expect(thangs?.isDefault).toBe(true);
    });

    it('has valid URL templates with placeholders', () => {
      for (const site of DEFAULT_STL_SEARCH_SITES) {
        expect(site.urlTemplate).toContain('{width}');
        expect(site.urlTemplate).toContain('{depth}');
      }
    });
  });

  describe('STL_SEARCH_CONSTRAINTS', () => {
    it('has max sites limit', () => {
      expect(STL_SEARCH_CONSTRAINTS.MAX_SITES).toBe(5);
    });

    it('has name max length', () => {
      expect(STL_SEARCH_CONSTRAINTS.NAME_MAX_LENGTH).toBe(24);
    });

    it('has URL template max length', () => {
      expect(STL_SEARCH_CONSTRAINTS.URL_TEMPLATE_MAX_LENGTH).toBe(256);
    });
  });

  // Note: Tests for loadSettings() initialization behavior are not feasible in unit tests
  // because Zustand stores initialize their state once at module load time.
  // The localStorage loading and normalization logic is tested via e2e tests instead.
});
