import { describe, it, expect } from 'vitest';
import { BUILT_IN_PRESETS, getPresetById } from '../constants/presets';

describe('built-in presets', () => {
  it('has 5 built-in presets', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(5);
  });

  it('all presets have unique IDs', () => {
    const ids = BUILT_IN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all presets have required fields', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.overrides).toBeDefined();
      expect(typeof preset.overrides).toBe('object');
    }
  });

  it('getPresetById finds existing presets', () => {
    const heavyDuty = getPresetById('heavy-duty');
    expect(heavyDuty).toBeDefined();
    if (!heavyDuty) return;
    expect(heavyDuty.name).toBe('Heavy Duty');
  });

  it('getPresetById returns undefined for unknown ID', () => {
    expect(getPresetById('nonexistent')).toBeUndefined();
  });

  it('heavy-duty preset sets rugged style and magnet base', () => {
    const preset = getPresetById('heavy-duty');
    expect(preset).toBeDefined();
    if (!preset) return;
    expect(preset.overrides.style).toBe('rugged');
    expect(preset.overrides.base?.style).toBe('magnet');
    expect(preset.overrides.scoop?.enabled).toBe(true);
  });

  it('quick-print preset sets lite style and no stacking lip', () => {
    const preset = getPresetById('quick-print');
    expect(preset).toBeDefined();
    if (!preset) return;
    expect(preset.overrides.style).toBe('lite');
    expect(preset.overrides.base?.stackingLip).toBe(false);
    expect(preset.overrides.scoop?.enabled).toBe(false);
  });

  it('workshop preset sets screw base and label enabled', () => {
    const preset = getPresetById('workshop');
    expect(preset).toBeDefined();
    if (!preset) return;
    expect(preset.overrides.base?.style).toBe('screw');
    expect(preset.overrides.label?.enabled).toBe(true);
    expect(preset.overrides.scoop?.enabled).toBe(true);
  });

  it('vase-mode preset disables all interior features', () => {
    const preset = getPresetById('vase-mode');
    expect(preset).toBeDefined();
    if (!preset) return;
    expect(preset.overrides.style).toBe('vase');
    expect(preset.overrides.dividers?.x).toBe(0);
    expect(preset.overrides.dividers?.y).toBe(0);
    expect(preset.overrides.scoop?.enabled).toBe(false);
    expect(preset.overrides.inserts).toEqual([]);
  });

  it('divider-grid preset sets 2×2 dividers', () => {
    const preset = getPresetById('divider-grid');
    expect(preset).toBeDefined();
    if (!preset) return;
    expect(preset.overrides.dividers?.x).toBe(1);
    expect(preset.overrides.dividers?.y).toBe(1);
  });

  it('presets do not override width or depth (preserves dimensions)', () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(preset.overrides.width).toBeUndefined();
      expect(preset.overrides.depth).toBeUndefined();
    }
  });
});
