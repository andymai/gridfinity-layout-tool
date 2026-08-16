import { describe, it, expect } from 'vitest';
import type { Cutout } from '@/features/bin-designer/types';
import {
  REPEAT_PRESETS,
  buildPresetConfig,
  clampedDefaultConfig,
  presetFits,
  presetInstanceCount,
} from './repeatPresets';
import { arrayInstanceCount, arrayFieldBounds } from '@/shared/utils/cutoutArray';

function cutout(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'c1',
    shape: 'rectangle',
    x: 5,
    y: 5,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...overrides,
  };
}

const preset = (id: string) => {
  const found = REPEAT_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`no preset ${id}`);
  return found;
};

describe('preset configs', () => {
  it('expands to the instance count its label promises', () => {
    for (const p of REPEAT_PRESETS) {
      const config = buildPresetConfig(p, cutout());
      expect(arrayInstanceCount(config)).toBe(presetInstanceCount(p));
    }
  });

  it('leaves a printable gap between instances', () => {
    const c = cutout({ width: 10, depth: 10 });
    const config = buildPresetConfig(preset('grid3x2'), c);

    expect(config.pitchX).toBeGreaterThan(c.width);
    expect(config.pitchY).toBeGreaterThan(c.depth);
  });

  it('builds a ring for the radial preset', () => {
    expect(buildPresetConfig(preset('ring6'), cutout()).mode).toBe('radial');
  });
});

describe('feasibility', () => {
  it('accepts every preset on a bin with room to spare', () => {
    // Centred: a ring is bounded by the master's clearance to the nearest
    // edge, so a corner-hugging cutout legitimately has no room for one.
    const centred = cutout({ x: 195, y: 195 });
    for (const p of REPEAT_PRESETS) {
      expect(presetFits(p, centred, 400, 400)).toBe(true);
    }
  });

  it('rejects a preset that would not fit the bin', () => {
    expect(presetFits(preset('row5'), cutout(), 40, 40)).toBe(false);
  });

  it('rejects a ring on a cutout with no clearance to the nearest edge', () => {
    expect(presetFits(preset('ring6'), cutout({ x: 1, y: 1 }), 400, 400)).toBe(false);
  });

  it('never offers a preset the array bounds would immediately clamp', () => {
    const c = cutout({ x: 2, y: 2 });
    for (const p of REPEAT_PRESETS) {
      if (!presetFits(p, c, 60, 60)) continue;
      const config = buildPresetConfig(p, c);
      const bounds = arrayFieldBounds(c, 60, 60, config);
      if (config.mode === 'radial') {
        expect(config.radius).toBeLessThanOrEqual(bounds.maxRadius);
      } else {
        expect(config.cols).toBeLessThanOrEqual(bounds.maxCols);
        expect(config.rows).toBeLessThanOrEqual(bounds.maxRows);
      }
    }
  });
});

describe('fallback config', () => {
  it('trims the default to what the bin can hold', () => {
    const config = clampedDefaultConfig(cutout(), 35, 400);
    expect(config).not.toBeNull();
    if (config) expect(config.cols).toBeLessThan(3);
  });

  it('returns null rather than a one-instance repeat that does nothing', () => {
    expect(clampedDefaultConfig(cutout({ x: 0, y: 0, width: 30, depth: 30 }), 32, 32)).toBeNull();
  });
});
