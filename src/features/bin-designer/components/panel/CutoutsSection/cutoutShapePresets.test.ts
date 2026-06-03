import { describe, it, expect } from 'vitest';
import { HEX_ACROSS_FLATS_PRESETS, CIRCLE_DIAMETER_PRESETS } from './cutoutShapePresets';

describe('cutout size presets', () => {
  it('exposes the 1/4" hex bit spec at 6.35mm', () => {
    const hex = HEX_ACROSS_FLATS_PRESETS.find((p) => p.id === 'hex-1-4');
    expect(hex?.mm).toBeCloseTo(6.35, 2);
  });

  it('exposes the three socket drive sizes for circles', () => {
    const ids = CIRCLE_DIAMETER_PRESETS.map((p) => p.id);
    expect(ids).toContain('drive-1-4');
    expect(ids).toContain('drive-3-8');
    expect(ids).toContain('drive-1-2');
    expect(CIRCLE_DIAMETER_PRESETS.find((p) => p.id === 'drive-1-2')?.mm).toBeCloseTo(12.7, 2);
  });

  it('uses unique ids and positive sizes throughout', () => {
    for (const list of [HEX_ACROSS_FLATS_PRESETS, CIRCLE_DIAMETER_PRESETS]) {
      const ids = list.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(list.every((p) => p.mm > 0 && p.label.length > 0)).toBe(true);
    }
  });
});
