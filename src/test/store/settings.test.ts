import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSettingsStore, DEFAULT_SETTINGS } from '../../store/settings';
import { resetAllStores, createIsolatedLocalStorageMock } from '../testUtils';

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

      saveCurrentAsDefaults(
        { width: 25, depth: 20, height: 15 },
        300,
        50,
        10
      );

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultDrawerWidth).toBe(25);
      expect(settings.defaultDrawerDepth).toBe(20);
      expect(settings.defaultDrawerHeight).toBe(15);
      expect(settings.defaultPrintBedSize).toBe(300);
      expect(settings.defaultGridUnitMm).toBe(50);
      expect(settings.defaultHeightUnitMm).toBe(10);
    });

    it('preserves non-layout settings', () => {
      const { updateSetting, saveCurrentAsDefaults } = useSettingsStore.getState();

      // Set a non-layout setting
      updateSetting('defaultZoom', 1.5);

      // Save layout defaults
      saveCurrentAsDefaults(
        { width: 25, depth: 20, height: 15 },
        300,
        50,
        10
      );

      const settings = useSettingsStore.getState().settings;
      expect(settings.defaultZoom).toBe(1.5);
    });

    it('persists to localStorage', () => {
      const { saveCurrentAsDefaults } = useSettingsStore.getState();

      saveCurrentAsDefaults(
        { width: 25, depth: 20, height: 15 },
        300,
        50,
        10
      );

      const savedData = JSON.parse(localStorageMock.mock._store['gridfinity-settings-v1']);
      expect(savedData.defaultDrawerWidth).toBe(25);
      expect(savedData.defaultPrintBedSize).toBe(300);
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('matches createDefaultLayout values', () => {
      // These should match the values in createDefaultLayout in constants.ts
      expect(DEFAULT_SETTINGS.defaultDrawerWidth).toBe(10);
      expect(DEFAULT_SETTINGS.defaultDrawerDepth).toBe(8);
      expect(DEFAULT_SETTINGS.defaultDrawerHeight).toBe(12);
      expect(DEFAULT_SETTINGS.defaultPrintBedSize).toBe(256);
      expect(DEFAULT_SETTINGS.defaultGridUnitMm).toBe(42);
      expect(DEFAULT_SETTINGS.defaultHeightUnitMm).toBe(7);
    });
  });
});
