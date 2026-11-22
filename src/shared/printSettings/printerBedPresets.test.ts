import { describe, it, expect } from 'vitest';
import { CONSTRAINTS } from '@/core/constants';
import { PRINTER_BED_PRESETS, findPrinterBedPreset } from './printerBedPresets';

describe('PRINTER_BED_PRESETS', () => {
  it('gives every printer a unique id', () => {
    const ids = PRINTER_BED_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every bed inside the range the bed input accepts', () => {
    for (const preset of PRINTER_BED_PRESETS) {
      for (const mm of [preset.widthMm, preset.depthMm]) {
        expect(Number.isInteger(mm)).toBe(true);
        expect(mm).toBeGreaterThanOrEqual(CONSTRAINTS.PRINT_BED_MM_MIN);
        expect(mm).toBeLessThanOrEqual(CONSTRAINTS.PRINT_BED_MM_MAX);
      }
    }
  });

  it('lists each brand in one run, so the picker shows one group per brand', () => {
    const runs = PRINTER_BED_PRESETS.map((preset) => preset.brand).filter(
      (brand, index, brands) => index === 0 || brand !== brands[index - 1]
    );
    expect(new Set(runs).size).toBe(runs.length);
  });
});

describe('findPrinterBedPreset', () => {
  it('finds a printer by id', () => {
    const [first] = PRINTER_BED_PRESETS;
    expect(first).toBeDefined();
    if (!first) return;
    expect(findPrinterBedPreset(first.id)).toBe(first);
  });

  it('returns undefined for an unknown id', () => {
    expect(findPrinterBedPreset('not-a-printer')).toBeUndefined();
  });
});
