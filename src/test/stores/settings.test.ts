import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useSettingsStore,
  normalizeSortOrder,
  DEFAULT_SETTINGS,
  DEFAULT_BIN_LIST_SORT_ORDER,
} from '@/core/store/settings';

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store to default state
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateSetting', () => {
    it('updates a single setting', () => {
      useSettingsStore.getState().updateSetting('defaultDrawerWidth', 15);
      expect(useSettingsStore.getState().settings.defaultDrawerWidth).toBe(15);
    });

    it('persists to localStorage', () => {
      useSettingsStore.getState().updateSetting('defaultDrawerDepth', 12);
      const stored = JSON.parse(localStorage.getItem('gridfinity-settings-v1') || '{}');
      expect(stored.defaultDrawerDepth).toBe(12);
    });
  });

  describe('updateSettings', () => {
    it('updates multiple settings at once', () => {
      useSettingsStore.getState().updateSettings({
        defaultDrawerWidth: 15,
        defaultDrawerDepth: 12,
      });
      const { settings } = useSettingsStore.getState();
      expect(settings.defaultDrawerWidth).toBe(15);
      expect(settings.defaultDrawerDepth).toBe(12);
    });
  });

  describe('resetSettings', () => {
    it('resets to default values', () => {
      useSettingsStore.getState().updateSetting('defaultDrawerWidth', 99);
      useSettingsStore.getState().resetSettings();
      expect(useSettingsStore.getState().settings.defaultDrawerWidth).toBe(
        DEFAULT_SETTINGS.defaultDrawerWidth
      );
    });
  });

  describe('saveCurrentAsDefaults', () => {
    it('saves drawer and unit settings', () => {
      useSettingsStore
        .getState()
        .saveCurrentAsDefaults({ width: 20, depth: 16, height: 15 }, 300, 50, 10, 6);
      const { settings } = useSettingsStore.getState();
      expect(settings.defaultDrawerWidth).toBe(20);
      expect(settings.defaultDrawerDepth).toBe(16);
      expect(settings.defaultDrawerHeight).toBe(15);
      expect(settings.defaultPrintBedSize).toBe(300);
      expect(settings.defaultGridUnitMm).toBe(50);
      expect(settings.defaultHeightUnitMm).toBe(10);
      expect(settings.defaultLayerHeight).toBe(6);
    });
  });
});

describe('normalizeSortOrder', () => {
  it('returns default when undefined', () => {
    const result = normalizeSortOrder(undefined);
    expect(result).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
  });

  it('returns default when not an array', () => {
    const result = normalizeSortOrder('invalid' as unknown as typeof DEFAULT_BIN_LIST_SORT_ORDER);
    expect(result).toEqual(DEFAULT_BIN_LIST_SORT_ORDER);
  });

  it('preserves valid stored order', () => {
    const stored = [
      { field: 'size' as const, enabled: true },
      { field: 'category' as const, enabled: false },
    ];
    const result = normalizeSortOrder(stored);
    expect(result[0]).toEqual({ field: 'size', enabled: true });
    expect(result[1]).toEqual({ field: 'category', enabled: false });
  });

  it('adds missing fields as disabled', () => {
    const stored = [{ field: 'category' as const, enabled: true }];
    const result = normalizeSortOrder(stored);
    // Should have all fields
    expect(result.length).toBe(DEFAULT_BIN_LIST_SORT_ORDER.length);
    // Missing fields should be at the end, disabled
    const missingFields = result.filter((s) => s.field !== 'category');
    expect(missingFields.every((s) => !s.enabled)).toBe(true);
  });

  it('filters out invalid fields', () => {
    const stored = [
      { field: 'category' as const, enabled: true },
      { field: 'invalid_field' as const, enabled: true },
    ];
    const result = normalizeSortOrder(stored as typeof DEFAULT_BIN_LIST_SORT_ORDER);
    expect(result.find((s) => s.field === ('invalid_field' as typeof s.field))).toBeUndefined();
  });
});

describe('settings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles localStorage errors gracefully', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Storage error');
    });

    // Should not throw
    expect(() => {
      useSettingsStore.getState().updateSetting('defaultDrawerWidth', 15);
    }).not.toThrow();
  });
});
