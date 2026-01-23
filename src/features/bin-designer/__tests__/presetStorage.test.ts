import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadUserPresets,
  createUserPreset,
  deleteUserPreset,
  MAX_USER_PRESETS,
} from '../storage/presetStorage';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';

const STORAGE_KEY = 'gridfinity-designer-presets';

describe('presetStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadUserPresets', () => {
    it('returns empty array when no presets exist', () => {
      expect(loadUserPresets()).toEqual([]);
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json');
      expect(loadUserPresets()).toEqual([]);
    });

    it('loads presets from localStorage', () => {
      const presets = [
        { id: 'test-1', name: 'A', description: '', overrides: {}, createdAt: 1000 },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
      expect(loadUserPresets()).toEqual(presets);
    });
  });

  describe('createUserPreset', () => {
    it('creates a preset with style-related params only', () => {
      const preset = createUserPreset('My Style', 'A description', DEFAULT_BIN_PARAMS);

      expect(preset.name).toBe('My Style');
      expect(preset.description).toBe('A description');
      expect(preset.id).toMatch(/^preset-\d+-[a-z0-9]+$/);
      expect(preset.createdAt).toBeGreaterThan(0);

      // Should include style params
      expect(preset.overrides.style).toBe(DEFAULT_BIN_PARAMS.style);
      expect(preset.overrides.base).toEqual(DEFAULT_BIN_PARAMS.base);
      expect(preset.overrides.dividers).toEqual(DEFAULT_BIN_PARAMS.dividers);
      expect(preset.overrides.scoop).toBe(DEFAULT_BIN_PARAMS.scoop);
      expect(preset.overrides.label).toEqual(DEFAULT_BIN_PARAMS.label);
      expect(preset.overrides.walls).toEqual(DEFAULT_BIN_PARAMS.walls);

      // Should NOT include dimensions or inserts
      expect(preset.overrides.width).toBeUndefined();
      expect(preset.overrides.depth).toBeUndefined();
      expect(preset.overrides.height).toBeUndefined();
      expect(preset.overrides.inserts).toBeUndefined();
    });

    it('trims whitespace from name and description', () => {
      const preset = createUserPreset('  Spaced  ', '  desc  ', DEFAULT_BIN_PARAMS);
      expect(preset.name).toBe('Spaced');
      expect(preset.description).toBe('desc');
    });

    it('persists to localStorage', () => {
      createUserPreset('Test', '', DEFAULT_BIN_PARAMS);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Test');
    });

    it('appends to existing presets', () => {
      createUserPreset('First', '', DEFAULT_BIN_PARAMS);
      createUserPreset('Second', '', DEFAULT_BIN_PARAMS);
      expect(loadUserPresets()).toHaveLength(2);
      expect(loadUserPresets()[0].name).toBe('First');
      expect(loadUserPresets()[1].name).toBe('Second');
    });

    it('generates unique IDs for each preset', () => {
      const p1 = createUserPreset('A', '', DEFAULT_BIN_PARAMS);
      const p2 = createUserPreset('B', '', DEFAULT_BIN_PARAMS);
      expect(p1.id).not.toBe(p2.id);
    });
  });

  describe('deleteUserPreset', () => {
    it('removes a preset by ID', () => {
      const p1 = createUserPreset('Keep', '', DEFAULT_BIN_PARAMS);
      const p2 = createUserPreset('Delete', '', DEFAULT_BIN_PARAMS);

      deleteUserPreset(p2.id);
      const remaining = loadUserPresets();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(p1.id);
    });

    it('does nothing if ID not found', () => {
      createUserPreset('Only', '', DEFAULT_BIN_PARAMS);
      deleteUserPreset('nonexistent');
      expect(loadUserPresets()).toHaveLength(1);
    });
  });

  describe('MAX_USER_PRESETS', () => {
    it('is 20', () => {
      expect(MAX_USER_PRESETS).toBe(20);
    });
  });
});
